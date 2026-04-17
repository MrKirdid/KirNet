--!strict

--[[
	Codec.luau — Buffer serialization / deserialization for KirNet.

	Supported types:
		number — auto-selects i8/i16/i32/f32/f64 based on value
		string — u32 length prefix + raw bytes
		boolean — single byte (0/1)
		Vector3 — 3× f32
		Vector2 — 2× f32
		CFrame — position 3× f32 + quaternion 4× f32
		Color3 — 3× u8
		UDim2 — 4× f32
		nil — tag only
		table — recursive type-tagged key/value pairs
		Instance/userdata — passthrough (sent alongside buffer, not encoded)
]]

local Codec = {}

-- Type tags
local TAG_NIL = 0
local TAG_BOOL = 1
local TAG_INT8 = 2
local TAG_INT16 = 3
local TAG_INT32 = 4
local TAG_F32 = 5
local TAG_F64 = 6
local TAG_STRING = 7
local TAG_VECTOR3 = 8
local TAG_VECTOR2 = 9
local TAG_CFRAME = 10
local TAG_COLOR3 = 11
local TAG_UDIM2 = 12
local TAG_TABLE = 13
local TAG_PASSTHROUGH = 14

local function roundToPrecision(value: number, precision: number): number
	local mult = 10 ^ precision
	return math.floor(value * mult + 0.5) / mult
end

local function ensureSize(buf: buffer, needed: number): buffer
	local len = buffer.len(buf)
	if needed <= len then
		return buf
	end
	local newSize = len
	while newSize < needed do
		newSize = newSize * 2
	end
	local newBuf = buffer.create(newSize)
	buffer.copy(newBuf, 0, buf, 0, len)
	return newBuf
end

-- Forward declarations for recursive table support
local writeValue: (
	buf: buffer,
	cursor: number,
	value: any,
	precision: number,
	lossy: boolean,
	passthrough: { any }
) -> (buffer, number)
local readValue: (buf: buffer, cursor: number, precision: number?, passthrough: { any }?) -> (any, number)

local function writeTag(buf: buffer, cursor: number, tag: number): (buffer, number)
	buf = ensureSize(buf, cursor + 1)
	buffer.writeu8(buf, cursor, tag)
	return buf, cursor + 1
end

local function writeBool(buf: buffer, cursor: number, value: boolean): (buffer, number)
	buf = ensureSize(buf, cursor + 1)
	buffer.writeu8(buf, cursor, if value then 1 else 0)
	return buf, cursor + 1
end

local function writeI8(buf: buffer, cursor: number, value: number): (buffer, number)
	buf = ensureSize(buf, cursor + 1)
	buffer.writei8(buf, cursor, value)
	return buf, cursor + 1
end

local function writeI16(buf: buffer, cursor: number, value: number): (buffer, number)
	buf = ensureSize(buf, cursor + 2)
	buffer.writei16(buf, cursor, value)
	return buf, cursor + 2
end

local function writeI32(buf: buffer, cursor: number, value: number): (buffer, number)
	buf = ensureSize(buf, cursor + 4)
	buffer.writei32(buf, cursor, value)
	return buf, cursor + 4
end

local function writeF32(buf: buffer, cursor: number, value: number): (buffer, number)
	buf = ensureSize(buf, cursor + 4)
	buffer.writef32(buf, cursor, value)
	return buf, cursor + 4
end

local function writeF64(buf: buffer, cursor: number, value: number): (buffer, number)
	buf = ensureSize(buf, cursor + 8)
	buffer.writef64(buf, cursor, value)
	return buf, cursor + 8
end

local function writeString(buf: buffer, cursor: number, value: string): (buffer, number)
	local len = #value
	buf = ensureSize(buf, cursor + 4 + len)
	buffer.writeu32(buf, cursor, len)
	cursor += 4
	if len > 0 then
		buffer.writestring(buf, cursor, value)
	end
	return buf, cursor + len
end

local function writeNumber(
	buf: buffer,
	cursor: number,
	value: number,
	precision: number,
	lossy: boolean
): (buffer, number)
	-- Integer check
	if value == math.floor(value) and value == value then
		if value >= -128 and value <= 127 then
			buf, cursor = writeTag(buf, cursor, TAG_INT8)
			return writeI8(buf, cursor, value)
		elseif value >= -32768 and value <= 32767 then
			buf, cursor = writeTag(buf, cursor, TAG_INT16)
			return writeI16(buf, cursor, value)
		elseif value >= -2147483648 and value <= 2147483647 then
			buf, cursor = writeTag(buf, cursor, TAG_INT32)
			return writeI32(buf, cursor, value)
		end
	end
	-- Float
	local rounded = if lossy then roundToPrecision(value, precision) else value
	if lossy then
		buf, cursor = writeTag(buf, cursor, TAG_F32)
		return writeF32(buf, cursor, rounded)
	else
		buf, cursor = writeTag(buf, cursor, TAG_F64)
		return writeF64(buf, cursor, rounded)
	end
end

function writeValue(
	buf: buffer,
	cursor: number,
	value: any,
	precision: number,
	lossy: boolean,
	passthrough: { any }
): (buffer, number)
	if value == nil then
		return writeTag(buf, cursor, TAG_NIL)
	end

	local t = typeof(value)

	if t == "boolean" then
		buf, cursor = writeTag(buf, cursor, TAG_BOOL)
		return writeBool(buf, cursor, value)
	elseif t == "number" then
		return writeNumber(buf, cursor, value, precision, lossy)
	elseif t == "string" then
		buf, cursor = writeTag(buf, cursor, TAG_STRING)
		return writeString(buf, cursor, value)
	elseif t == "Vector3" then
		buf, cursor = writeTag(buf, cursor, TAG_VECTOR3)
		local v = value :: Vector3
		local x = if lossy then roundToPrecision(v.X, precision) else v.X
		local y = if lossy then roundToPrecision(v.Y, precision) else v.Y
		local z = if lossy then roundToPrecision(v.Z, precision) else v.Z
		buf, cursor = writeF32(buf, cursor, x)
		buf, cursor = writeF32(buf, cursor, y)
		return writeF32(buf, cursor, z)
	elseif t == "Vector2" then
		buf, cursor = writeTag(buf, cursor, TAG_VECTOR2)
		local v = value :: Vector2
		local x = if lossy then roundToPrecision(v.X, precision) else v.X
		local y = if lossy then roundToPrecision(v.Y, precision) else v.Y
		buf, cursor = writeF32(buf, cursor, x)
		return writeF32(buf, cursor, y)
	elseif t == "CFrame" then
		buf, cursor = writeTag(buf, cursor, TAG_CFRAME)
		local cf = value :: CFrame
		local pos = cf.Position
		-- Position
		local px = if lossy then roundToPrecision(pos.X, precision) else pos.X
		local py = if lossy then roundToPrecision(pos.Y, precision) else pos.Y
		local pz = if lossy then roundToPrecision(pos.Z, precision) else pos.Z
		buf, cursor = writeF32(buf, cursor, px)
		buf, cursor = writeF32(buf, cursor, py)
		buf, cursor = writeF32(buf, cursor, pz)
		-- Rotation as axis-angle stored in the 9-component rotation matrix → quaternion
		local _, _, _, r00, r01, r02, r10, r11, r12, r20, r21, r22 = cf:GetComponents()
		local trace = r00 + r11 + r22
		local qx, qy, qz, qw: number
		if trace > 0 then
			local s = math.sqrt(trace + 1) * 2
			qw = 0.25 * s
			qx = (r21 - r12) / s
			qy = (r02 - r20) / s
			qz = (r10 - r01) / s
		elseif r00 > r11 and r00 > r22 then
			local s = math.sqrt(1 + r00 - r11 - r22) * 2
			qw = (r21 - r12) / s
			qx = 0.25 * s
			qy = (r01 + r10) / s
			qz = (r02 + r20) / s
		elseif r11 > r22 then
			local s = math.sqrt(1 + r11 - r00 - r22) * 2
			qw = (r02 - r20) / s
			qx = (r01 + r10) / s
			qy = 0.25 * s
			qz = (r12 + r21) / s
		else
			local s = math.sqrt(1 + r22 - r00 - r11) * 2
			qw = (r10 - r01) / s
			qx = (r02 + r20) / s
			qy = (r12 + r21) / s
			qz = 0.25 * s
		end
		local rqx = if lossy then roundToPrecision(qx, precision) else qx
		local rqy = if lossy then roundToPrecision(qy, precision) else qy
		local rqz = if lossy then roundToPrecision(qz, precision) else qz
		local rqw = if lossy then roundToPrecision(qw, precision) else qw
		buf, cursor = writeF32(buf, cursor, rqx)
		buf, cursor = writeF32(buf, cursor, rqy)
		buf, cursor = writeF32(buf, cursor, rqz)
		return writeF32(buf, cursor, rqw)
	elseif t == "Color3" then
		buf, cursor = writeTag(buf, cursor, TAG_COLOR3)
		local c = value :: Color3
		buf = ensureSize(buf, cursor + 3)
		buffer.writeu8(buf, cursor, math.clamp(math.floor(c.R * 255 + 0.5), 0, 255))
		buffer.writeu8(buf, cursor + 1, math.clamp(math.floor(c.G * 255 + 0.5), 0, 255))
		buffer.writeu8(buf, cursor + 2, math.clamp(math.floor(c.B * 255 + 0.5), 0, 255))
		return buf, cursor + 3
	elseif t == "UDim2" then
		buf, cursor = writeTag(buf, cursor, TAG_UDIM2)
		local u = value :: UDim2
		local xs = if lossy then roundToPrecision(u.X.Scale, precision) else u.X.Scale
		local xo = if lossy then roundToPrecision(u.X.Offset, precision) else u.X.Offset
		local ys = if lossy then roundToPrecision(u.Y.Scale, precision) else u.Y.Scale
		local yo = if lossy then roundToPrecision(u.Y.Offset, precision) else u.Y.Offset
		buf, cursor = writeF32(buf, cursor, xs)
		buf, cursor = writeF32(buf, cursor, xo)
		buf, cursor = writeF32(buf, cursor, ys)
		return writeF32(buf, cursor, yo)
	elseif t == "table" then
		buf, cursor = writeTag(buf, cursor, TAG_TABLE)
		-- Count entries
		local count = 0
		for _ in value do
			count += 1
		end
		buf = ensureSize(buf, cursor + 4)
		buffer.writeu32(buf, cursor, count)
		cursor += 4
		for k, v in value do
			buf, cursor = writeValue(buf, cursor, k, precision, lossy, passthrough)
			buf, cursor = writeValue(buf, cursor, v, precision, lossy, passthrough)
		end
		return buf, cursor
	end

	-- Passthrough for unsupported types (Instance, userdata, etc.)
	-- These values are sent alongside the buffer, not encoded into it.
	local ptIdx = #passthrough + 1
	table.insert(passthrough, value)
	buf, cursor = writeTag(buf, cursor, TAG_PASSTHROUGH)
	buf = ensureSize(buf, cursor + 2)
	buffer.writeu16(buf, cursor, ptIdx)
	return buf, cursor + 2
end

function readValue(buf: buffer, cursor: number, precision: number?, passthrough: { any }?): (any, number)
	local tag = buffer.readu8(buf, cursor)
	cursor += 1

	if tag == TAG_NIL then
		return nil, cursor
	elseif tag == TAG_BOOL then
		local v = buffer.readu8(buf, cursor)
		return v ~= 0, cursor + 1
	elseif tag == TAG_INT8 then
		return buffer.readi8(buf, cursor), cursor + 1
	elseif tag == TAG_INT16 then
		return buffer.readi16(buf, cursor), cursor + 2
	elseif tag == TAG_INT32 then
		return buffer.readi32(buf, cursor), cursor + 4
	elseif tag == TAG_F32 then
		local v = buffer.readf32(buf, cursor)
		if precision then
			v = roundToPrecision(v, precision)
		end
		return v, cursor + 4
	elseif tag == TAG_F64 then
		return buffer.readf64(buf, cursor), cursor + 8
	elseif tag == TAG_STRING then
		local len = buffer.readu32(buf, cursor)
		cursor += 4
		local str = buffer.readstring(buf, cursor, len)
		return str, cursor + len
	elseif tag == TAG_VECTOR3 then
		local x = buffer.readf32(buf, cursor)
		local y = buffer.readf32(buf, cursor + 4)
		local z = buffer.readf32(buf, cursor + 8)
		if precision then
			x = roundToPrecision(x, precision)
			y = roundToPrecision(y, precision)
			z = roundToPrecision(z, precision)
		end
		return Vector3.new(x, y, z), cursor + 12
	elseif tag == TAG_VECTOR2 then
		local x = buffer.readf32(buf, cursor)
		local y = buffer.readf32(buf, cursor + 4)
		if precision then
			x = roundToPrecision(x, precision)
			y = roundToPrecision(y, precision)
		end
		return Vector2.new(x, y), cursor + 8
	elseif tag == TAG_CFRAME then
		local px = buffer.readf32(buf, cursor)
		local py = buffer.readf32(buf, cursor + 4)
		local pz = buffer.readf32(buf, cursor + 8)
		cursor += 12
		local qx = buffer.readf32(buf, cursor)
		local qy = buffer.readf32(buf, cursor + 4)
		local qz = buffer.readf32(buf, cursor + 8)
		local qw = buffer.readf32(buf, cursor + 12)
		cursor += 16
		if precision then
			px = roundToPrecision(px, precision)
			py = roundToPrecision(py, precision)
			pz = roundToPrecision(pz, precision)
			qx = roundToPrecision(qx, precision)
			qy = roundToPrecision(qy, precision)
			qz = roundToPrecision(qz, precision)
			qw = roundToPrecision(qw, precision)
		end
		-- Quaternion → rotation matrix
		local x2 = qx * 2
		local y2 = qy * 2
		local z2 = qz * 2
		local wx = qw * x2
		local wy = qw * y2
		local wz = qw * z2
		local xx = qx * x2
		local xy = qx * y2
		local xz = qx * z2
		local yy = qy * y2
		local yz = qy * z2
		local zz = qz * z2
		return CFrame.new(
			px,
			py,
			pz,
			1 - (yy + zz),
			xy - wz,
			xz + wy,
			xy + wz,
			1 - (xx + zz),
			yz - wx,
			xz - wy,
			yz + wx,
			1 - (xx + yy)
		),
			cursor
	elseif tag == TAG_COLOR3 then
		local r = buffer.readu8(buf, cursor) / 255
		local g = buffer.readu8(buf, cursor + 1) / 255
		local b = buffer.readu8(buf, cursor + 2) / 255
		return Color3.new(r, g, b), cursor + 3
	elseif tag == TAG_UDIM2 then
		local xs = buffer.readf32(buf, cursor)
		local xo = buffer.readf32(buf, cursor + 4)
		local ys = buffer.readf32(buf, cursor + 8)
		local yo = buffer.readf32(buf, cursor + 12)
		if precision then
			xs = roundToPrecision(xs, precision)
			xo = roundToPrecision(xo, precision)
			ys = roundToPrecision(ys, precision)
			yo = roundToPrecision(yo, precision)
		end
		return UDim2.new(xs, xo, ys, yo), cursor + 16
	elseif tag == TAG_TABLE then
		local count = buffer.readu32(buf, cursor)
		cursor += 4
		local tbl = {}
		for _ = 1, count do
			local k, v
			k, cursor = readValue(buf, cursor, precision, passthrough)
			v, cursor = readValue(buf, cursor, precision, passthrough)
			tbl[k] = v
		end
		return tbl, cursor
	elseif tag == TAG_PASSTHROUGH then
		local idx = buffer.readu16(buf, cursor)
		cursor += 2
		if passthrough and passthrough[idx] then
			return passthrough[idx], cursor
		end
		return nil, cursor
	end

	error(string.format("[KirNet] Unknown codec tag: %d at cursor %d", tag, cursor - 1))
end

--- Encode a variadic list of values into a buffer.
--- Returns the buffer and a list of passthrough values (Instance, userdata, etc.)
--- that could not be buffer-encoded and must be sent alongside.
function Codec.encode(precision: number, lossy: boolean, ...: any): (buffer, { any })
	local argCount = select("#", ...)
	local buf = buffer.create(64)
	local cursor = 0
	local passthrough: { any } = {}

	-- Write arg count
	buf = ensureSize(buf, 4)
	buffer.writeu32(buf, 0, argCount)
	cursor = 4

	for i = 1, argCount do
		local v = select(i, ...)
		buf, cursor = writeValue(buf, cursor, v, precision, lossy, passthrough)
	end

	-- Trim to exact size
	if cursor < buffer.len(buf) then
		local trimmed = buffer.create(cursor)
		buffer.copy(trimmed, 0, buf, 0, cursor)
		return trimmed, passthrough
	end
	return buf, passthrough
end

--- Decode a buffer into a variadic list of values.
--- When precision is provided, f32 values are re-rounded to compensate for IEEE 754 representation error.
--- When passthrough is provided, TAG_PASSTHROUGH entries are resolved from the passthrough table.
function Codec.decode(buf: buffer, precision: number?, passthrough: { any }?): ...any
	local cursor = 0
	local argCount = buffer.readu32(buf, cursor)
	cursor = 4

	local results = table.create(argCount)
	for i = 1, argCount do
		local val
		val, cursor = readValue(buf, cursor, precision, passthrough)
		results[i] = val
	end

	return table.unpack(results, 1, argCount)
end

return Codec
