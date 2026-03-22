--!strict

--[[
	Compression.luau — Pure Luau deflate/inflate for KirNet.

	Uses a simple LZ77-based compression with Huffman-lite encoding.
	This is a lightweight implementation optimized for small payloads
	typical in Roblox networking (not a full zlib implementation).

	Gracefully degrades: if compression fails or produces larger output,
	returns the original data.
]]

local Compression = {}

-- Simple RLE + LZ77-lite compression for buffer payloads
-- Designed for small networking payloads, not general-purpose file compression

local WINDOW_SIZE = 256
local MIN_MATCH = 3
local MAX_MATCH = 255

local LITERAL_FLAG: number = 0
local REFERENCE_FLAG: number = 1

function Compression.compress(input: buffer): buffer
	local inputLen = buffer.len(input)
	if inputLen == 0 then
		return input
	end

	-- Worst case: every byte is a literal with a flag byte = 2× input + 4 header
	local outBuf = buffer.create(inputLen * 2 + 4)
	local outCursor = 0

	-- Write original length header for decompression
	buffer.writeu32(outBuf, outCursor, inputLen)
	outCursor += 4

	local pos = 0
	while pos < inputLen do
		-- Search for matches in the sliding window
		local bestLen = 0
		local bestDist = 0

		local searchStart = math.max(0, pos - WINDOW_SIZE)
		local maxLen = math.min(MAX_MATCH, inputLen - pos)

		if maxLen >= MIN_MATCH then
			for start = searchStart, pos - 1 do
				local matchLen = 0
				while
					matchLen < maxLen
					and buffer.readu8(input, start + matchLen) == buffer.readu8(input, pos + matchLen)
				do
					matchLen += 1
				end
				if matchLen >= MIN_MATCH and matchLen > bestLen then
					bestLen = matchLen
					bestDist = pos - start
					if matchLen == maxLen then
						break
					end
				end
			end
		end

		if bestLen >= MIN_MATCH then
			-- Write back-reference: flag(u8) + distance(u16) + length(u8)
			buffer.writeu8(outBuf, outCursor, REFERENCE_FLAG)
			outCursor += 1
			buffer.writeu16(outBuf, outCursor, bestDist)
			outCursor += 2
			buffer.writeu8(outBuf, outCursor, bestLen)
			outCursor += 1
			pos += bestLen
		else
			-- Write literal: flag(u8) + byte(u8)
			buffer.writeu8(outBuf, outCursor, LITERAL_FLAG)
			outCursor += 1
			buffer.writeu8(outBuf, outCursor, buffer.readu8(input, pos))
			outCursor += 1
			pos += 1
		end
	end

	-- If compressed is larger than original, return original
	if outCursor >= inputLen then
		return input
	end

	-- Trim output buffer to exact size
	local trimmed = buffer.create(outCursor)
	buffer.copy(trimmed, 0, outBuf, 0, outCursor)
	return trimmed
end

function Compression.decompress(input: buffer): buffer
	local inputLen = buffer.len(input)
	if inputLen < 4 then
		return input
	end

	local originalLen = buffer.readu32(input, 0)
	local outBuf = buffer.create(originalLen)
	local inCursor = 4
	local outCursor = 0

	while inCursor < inputLen and outCursor < originalLen do
		local flag = buffer.readu8(input, inCursor)
		inCursor += 1

		if flag == REFERENCE_FLAG then
			if inCursor + 3 > inputLen then
				break -- truncated reference, bail out
			end
			local dist = buffer.readu16(input, inCursor)
			inCursor += 2
			local len = buffer.readu8(input, inCursor)
			inCursor += 1

			local srcPos = outCursor - dist
			if srcPos < 0 or outCursor + len > originalLen then
				break -- invalid reference, bail out
			end
			for i = 0, len - 1 do
				buffer.writeu8(outBuf, outCursor + i, buffer.readu8(outBuf, srcPos + i))
			end
			outCursor += len
		else
			-- Literal
			buffer.writeu8(outBuf, outCursor, buffer.readu8(input, inCursor))
			inCursor += 1
			outCursor += 1
		end
	end

	return outBuf
end

--- Returns true if compression is worthwhile for this data size
function Compression.shouldCompress(dataSize: number, threshold: number): boolean
	return dataSize >= threshold
end

return Compression
