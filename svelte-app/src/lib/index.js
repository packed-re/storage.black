import CryptoJS from "crypto-js";

// returns true if equal
function CompareWordArrays(wa1, wa2)
{
	if(wa1.sigBytes !== wa2.sigBytes)
		return false;
	
	wa1 = wa1.words;
	wa2 = wa2.words;

	let wordCount = wa1.length;
	for(let i = 0; i < wordCount; ++i)
		if(wa1[i] !== wa2[i])
			return false;

	return true;
}

function XORWordArrays(wa1, wa2)
{
	let byteCount = wa1.sigBytes;
	if(byteCount !== wa2.sigBytes)
		return null;
	
	wa1 = wa1.words;
	wa2 = wa2.words;

	let out_words = [];

	let wordCount = wa1.length;
	for(let i = 0; i < wordCount; ++i)
		out_words[i] = wa1[i] ^ wa2[i];

	return new CryptoJS.lib.WordArray.init(out_words, byteCount)
}

// for cryptojs's "words"
function GetNByteMask(byte_n)
{
	switch(byte_n)
	{
		case 3:
			return 0xFFFFFFFF;
		case 2:
			return 0xFFFFFF00;
		case 1:
			return 0xFFFF0000;
		case 0:
			return 0xFF000000;
	}
}

// for cryptojs's "words"
function GetByteRangeMask(start, end) // end is included
{
	return GetNByteMask(end-start) >> (start * 8)
}

// this is up to 8x faster than converting it to a uint8array, using its slice function, and then converting back to a wordarray,
// and faster even still when not converting it back to a wordarray, when doing an aligned slice, and equal when doing a misaligned slice
function SliceWordArray(wa, start, end) // end is not included
{
	if(end === undefined)
		end = wa.sigBytes;

	if(start > wa.sigBytes || end > wa.sigBytes)
		return undefined;

	wa = wa.words;

	let byteCount = end - start;
	let words = [];
	
	if(start % 4 === 0) // aligned parse
	{
		let startWord = start / 4
		let endWord = end >>> 2;
		for(let i = startWord; i < endWord; ++i)
			words[words.length] = wa[i];

		let endByteOffset = (end-1) % 4; // includes last byte
		if(endByteOffset !== 3)
			words[words.length] = (wa[endWord] & GetByteRangeMask(0, endByteOffset)) << endByteOffset * 8;
	}
	else // misaligned parse
	{
		let startWord = start >>> 2;
		let dwordStride = (end - start) >>> 2;
		let endWord = startWord + dwordStride;

		let wordOffset = start - startWord * 4;
		let endByteOffset = (end - 1) % 4; // includes last byte

		let firstWordMask = GetByteRangeMask(wordOffset, 3); // ugly microoptimizations (this way its always atleast on par with a sole uint8array cast)
		let secondWordMask = GetByteRangeMask(0, wordOffset-1);
		
		let firstWordShift = wordOffset * 8;
		let secondWordShift = (4-wordOffset) * 8;

		for(let i = startWord; i < endWord; ++i) // read all the full dwords
			words[words.length] = ((wa[i] & firstWordMask) << firstWordShift) | ((wa[i+1] & secondWordMask) >>> secondWordShift);

		if(byteCount % 4 !== 0) // if there are leftover bytes we need to handle
		{
			if(endByteOffset < wordOffset) // if the final bytes spread across several words
				words[words.length] = ((wa[endWord] & firstWordMask) << firstWordShift) | ((wa[endWord + 1] & GetByteRangeMask(0, endByteOffset)) >>> secondWordShift)
			else // if the final bytes are all on the same word
				words[words.length] = (wa[endWord] & GetByteRangeMask(wordOffset, endByteOffset)) << firstWordShift
		}
	}
	
	return new CryptoJS.lib.WordArray.init(words, byteCount)
}

// atleast 2x faster than SliceWordArray
function ChopWordArray(wa, start, end) // same as above but does the slicing on the given array, instead of a newly created one
{	
	if(end === undefined)
		end = wa.sigBytes;

	if(start > wa.sigBytes || end > wa.sigBytes)
		return undefined;

	let byteCount = end - start;
	wa.sigBytes = byteCount;
	let out = wa;
	wa = wa.words;

	if(start % 4 === 0) // aligned parse
	{
		let startWord = start / 4
		for(let i = 0; i < startWord; ++i)
			wa.shift();
			
		let endWord = (end-start) >>> 2;
		let wordCount = wa.length;

		let endByteOffset = (end-1) % 4; // includes last byte
		if(endByteOffset !== 3)
		{			
			for(let i = endWord + 1; i < wordCount; ++i)
				wa.pop();

			wa[wa.length] &= GetByteRangeMask(0, endByteOffset);
		}
		else
			for(let i = endWord; i < wordCount; ++i)
				wa.pop();
	}
	else // misaligned parse
	{
		let startWord = start >>> 2;

		let wordOffset = start - startWord * 4;
		let endByteOffset = (end - 1) % 4; // includes last byte

		let firstWordMask = GetByteRangeMask(wordOffset, 3); // ugly microoptimizations (this way its always atleast on par with a sole uint8array cast)
		let secondWordMask = GetByteRangeMask(0, wordOffset-1);
		
		let firstWordShift = wordOffset * 8;
		let secondWordShift = (4-wordOffset) * 8;

		for(let i = 0; i < startWord; ++startWord)
			wa.shift();
			
		let endWord = (end - start) >>> 2; // (after shift)

		for(let i = 0; i < endWord; ++i) // move all the full dwords
			wa[i] = ((wa[i] & firstWordMask) << firstWordShift) | ((wa[i+1] & secondWordMask) >>> secondWordShift);

		if(byteCount % 4 !== 0) // if there are leftover bytes we need to handle
		{
			if(endByteOffset < wordOffset) // if the final bytes spread across several words
				wa[endWord] = ((wa[endWord] & firstWordMask) << firstWordShift) | ((wa[endWord + 1] & GetByteRangeMask(0, endByteOffset)) >>> secondWordShift);
			else // if the final bytes are all on the same word
				wa[endWord] = (wa[endWord] & GetByteRangeMask(wordOffset, endByteOffset)) << firstWordShift;
		}
		let wordCount = wa.length;
		for(let i = endWord+1; i < wordCount; ++i)
			wa.pop();
	}

	return out;
}

function RotateUInt32(ui32)
{
	return ((ui32 & 0x000000FF) << 24) | 
	       ((ui32 & 0x0000FF00) << 8) | 
	       ((ui32 & 0x00FF0000) >>> 8) | 
	       ((ui32 & 0xFF000000) >>> 24);
}

// the gain in speed, compared to Uint8ArrayToWordArray, varies a lot, but tends to be around the 2x mark
function ArrayBufferToWordArray(array_buffer) // for the sake of speed, this destroys the input array buffer. If you need it for something else afterwards, you should pass this function a copy by doing .slice(0)
{
	let byteCount = array_buffer.byteLength;
	let words = [];

	let leftOverByteCount  = byteCount % 4;
	let dwordStride = byteCount - leftOverByteCount;

	let uint32_array;
	let leftOverBytes;
	if(leftOverByteCount !== 0)
	{
		leftOverBytes = new Uint8Array(array_buffer.slice(dwordStride));
		array_buffer = array_buffer.transfer(dwordStride);
	}

	uint32_array = new Uint32Array(array_buffer);
	let dwordCount = dwordStride / 4;

	for(let i = 0; i < dwordCount; ++i)
		words[i] = RotateUInt32(uint32_array[i])

	if(leftOverBytes !== undefined)
		for(let i = 0; i < leftOverByteCount; ++i)
			words[dwordCount] |= leftOverBytes[i] << (24 - i*8);


	return new CryptoJS.lib.WordArray.init(words, byteCount);
}

function Uint8ArrayToWordArray(uint8arr)
{
	let byteCount = uint8arr.length;
	let words = [];

	for(let i = 0; i < byteCount; ++i)
	{
		let word_i = i >>> 2
		words[word_i] = (words[word_i] << 8) + uint8arr[i]; 																																																	// WARNING! WARNING! WARNING! CHROME IS FUCKING DOGSHIT AND WILL THROW A RANGEERROR AT AN ARBITRARY ARRAY LENGTH (50139473 when testied). BE EXCEPTIONALLY CAUTIOUS WITH CHROMIUM CLIENTS.
	}

	if(byteCount % 4 !== 0)
		words[words.length - 1] <<= 8 * (4 - byteCount % 4);

	return new CryptoJS.lib.WordArray.init(words, byteCount);
}

function Uint8ArrayToLatin1(uint8arr)
{
	let byteCount = uint8arr.length;
	let out = "";

	for(let i = 0; i < byteCount; ++i)
		out += String.fromCharCode(uint8arr[i]);

	return out;
}

function Latin1ToUint8Array(str)
{
	let stringLen = str.length;
	let out = new Uint8Array(stringLen);

	for(let i = 0; i < stringLen; ++i)
		out[i] = str.charCodeAt(i);

	return out;
}

function WordArrayToUint8Array(word_array)
{
	let byteCount = word_array.sigBytes;
	let out = new Uint8Array(byteCount);

	for(let i = 0; i < byteCount; ++i)
	{
		out[i] = (word_array.words[i >>> 2] >>> (24 - 8 * (i % 4))) & 0xFF;
	}

	return out;
}

let _ArgonBaseKeySalt = WordArrayToUint8Array(CryptoJS.enc.Hex.parse("57d7f4ba75600c6992d9e0eb2e2f6b0e5b750276675cef0c9b112c54a2f1dd82"));
let _AccountIDSalt = CryptoJS.enc.Hex.parse("5d54dfe28d8adb0a63fff0e518db2bed2eaedef5fd34084bc14f328f21832ba0");
let _MasterKeySalt = CryptoJS.enc.Hex.parse("170a3530f5d5bde9156e86a539b1b7500b40b6a7caa163e0f819f2ce9745adb8");
let _BaseDataIDSalt = CryptoJS.enc.Hex.parse("a03a0527ac9c906ad6dde127c16413a003d5fbc299eeb1562133cb8f997d2bec");

// Use this only when the page has loaded
function GenerateBaseKey(pass)
{
	let resolver;
	let promise = new Promise((resolve) => resolver = resolve);

	let argon2_worker = new Worker("/argon2_worker.js"); // realistically this is only going to get called once, and if not, we should be allowed to generate several keys simultaneously

	argon2_worker.postMessage({
		pass: pass,
		salt: _ArgonBaseKeySalt
	});

	argon2_worker.addEventListener("message", function(event){
		resolver(event.data);
		argon2_worker.terminate();
	})

	return promise;
}

function GenerateAccountID(base_key)
{
	return CryptoJS.HmacSHA256(base_key, _AccountIDSalt);
}

function GenerateMasterKey(base_key)
{
	return CryptoJS.HmacSHA256(base_key, _MasterKeySalt);
}

function GenerateBaseDataID(base_key)
{
	let hash = CryptoJS.HmacSHA256(base_key, _BaseDataIDSalt);
	let firstHalf = SliceWordArray(hash, 0, 16); // i should make a function that skips the slicing part and directly xors halves, but im out of time so
	let secondHalf = SliceWordArray(hash, 16);
	
	return XORWordArrays(firstHalf, secondHalf);
}

function GenerateUniqueDataID()
{
	return CryptoJS.lib.WordArray.random(16);
}

function GenerateIV()
{
	return CryptoJS.lib.WordArray.random(16);
}

function GenerateEncryptionKey()
{
	return CryptoJS.lib.WordArray.random(32);
}

// key needs to be of proper length otherwise SerializableCipher will break!!!! 
function ShortEncrypt(data, key, padding = CryptoJS.pad.Pkcs7) // key is a WordArrays. data should be able to be both a WordArray and a string
{
	let iv = GenerateIV();

	let ciphertext = CryptoJS.AES.encrypt(data, key, {
		mode: CryptoJS.mode.CBC,
		padding: padding,

		iv: iv
	}).ciphertext;

	let hmac_secret_salt = CryptoJS.lib.WordArray.random(8);

	let cipher_hmac = CryptoJS.HmacSHA256(
		ciphertext,
		key.clone().concat(hmac_secret_salt)
	);

	return { // The IV needs to be seperated, so that in the unlikely case that a padding oracle attack is possible, at the very least the first block has the ability to stay hidden, if properly secured
		iv: iv,
		output: hmac_secret_salt.concat(cipher_hmac).concat(ciphertext)
	};
}

function ShortDecrypt(data, key, iv, padding = CryptoJS.pad.Pkcs7) // everything is a word array
{
	if(data.sigBytes <= 40)
	{
		console.log("hmac info is missing");
		return false;
	}

	if(iv === undefined)
	{
		console.log("iv not provided");
		return false;
	}

	let hmac_secret_salt = SliceWordArray(data, 0, 8); // 64 bit salt
	let received_hmac = SliceWordArray(data, 8, 40); // 256 bits of SHA256
	let ciphertext = SliceWordArray(data, 40);

	let calculated_hmac = CryptoJS.HmacSHA256(ciphertext, key.clone().concat(hmac_secret_salt));

	if(!CompareWordArrays(received_hmac, calculated_hmac))
	{
		console.log("ciphertext is malformed");
		return false;
	}

	let plaintext = CryptoJS.AES.decrypt({ciphertext: ciphertext}, key, {
		mode: CryptoJS.mode.CBC,
		padding: padding,

		iv: iv
	});

	return plaintext;
}

function CombineCipherIV(encr_object)
{
	return encr_object.output.concat(encr_object.iv);
}

function ChopCipherIV(cipher)
{
	let iv = SliceWordArray(cipher, cipher.sigBytes-16);
	ChopWordArray(cipher, 0, cipher.sigBytes-16);
	return iv;
}

function CompleteShortEncrypt(data, key, iv, padding = CryptoJS.pad.Pkcs7)
{
	return CombineCipherIV(ShortEncrypt(
		data, key, iv, padding
	));
}

function CompleteShortDecrypt(data, key, padding = CryptoJS.pad.Pkcs7)
{
	let iv = ChopCipherIV(data);
	return ShortDecrypt(
		data, key, iv, padding
	);
}

class Encryptor
{
	constructor(source_blob, chunk_size, key) // key is a word array
	{
		this._finished = false;

		this._source_blob = source_blob;
		
		this._chunk_size = chunk_size;
		this._read_buffer = new ArrayBuffer(this._chunk_size + 65536 * 3); // Extra bytes so that the browser isn't forced to do extra unnececary logic for uneven memory allocation.
		this._buffer_read_offset = 0;

		this._stream_reader = this._source_blob.stream().getReader({mode: "byob"});

		this.iv = GenerateIV();
		this.hmac_secret_salt = CryptoJS.lib.WordArray.random(8);

		this._hmac_stream = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, key.clone().concat(this.hmac_secret_salt));
		this._aes_stream = CryptoJS.algo.AES.createEncryptor(key, {
			mode: CryptoJS.mode.CBC,
			padding: CryptoJS.pad.Pkcs7,
			
			iv: this.iv
		});
	}

	EncryptChunk(callback) // callback called with ciphertext, done. When done is true, buffer is the final bit of encrypted data.
	{
		let _this = this;

		this._stream_reader.read(new Uint8Array(this._read_buffer, this._buffer_read_offset)).then(function({value, done})
		{
			_this._read_buffer = value.buffer; // 65536
			_this._buffer_read_offset += value.byteLength;

			if(done) // despite how it may be presented in mdn, when the done parameter is set to true, value always points to an empty buffer, instead of undefined or the last chunk
			{
				_this._finished = true;

				let ciphertext;
				if(_this._buffer_read_offset > 0)
					ciphertext = _this._aes_stream.process(Uint8ArrayToWordArray(new Uint8Array(_this._read_buffer, 0, _this._buffer_read_offset))).concat(_this._aes_stream.finalize());
				else 
					ciphertext = _this._aes_stream.finalize();

				_this._hmac_stream.update(ciphertext);
				return callback(ciphertext, done);
			}
			else if(_this._buffer_read_offset >= _this._chunk_size)
			{
				let ciphertext = _this._aes_stream.process(Uint8ArrayToWordArray(new Uint8Array(_this._read_buffer, 0, _this._buffer_read_offset)));
				_this._buffer_read_offset = 0;

				_this._hmac_stream.update(ciphertext);
				return callback(ciphertext, done);
			}

			_this.EncryptChunk(callback); // keep executing until we've read the desired amount of memory
		});
	}

	RetrieveHMAC() // returns hmac_salt.concat(hmac)
	{
		if(this._finished)
		{
			if(this._calculated_hmac === undefined)
				this._calculated_hmac = this._hmac_stream.finalize();

			return this._calculated_hmac;
		}
		else
			throw "Encryptor.RetrieveHMAC called before stream finished";
	}
}

class Decryptor
{
	constructor(key, iv, hmac_secret_salt, hmac) // everything is a WordArray
	{
		this._hmac = hmac;

		this._stream_reader = this._source_blob.stream().getReader({mode: "byob"});

		this._hmac_stream = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, key.clone().concat(hmac_secret_salt));
		this._aes_stream = CryptoJS.algo.AES.createDecryptor(key, {
			mode: CryptoJS.mode.CBC,
			padding: CryptoJS.pad.Pkcs7,
			
			iv: iv
		});
	}

	DecryptChunk(chunk) // chunk is expected to be a WordArray
	{
		this._hmac_stream.process(chunk);
		return this._aes_stream.process(chunk);
	}

	Finalize()
	{
		this._finished = true;
		return this._aes_stream.finalize();
	}

	ValidHMAC() // returns bool
	{
		if(this._finished)
		{
			if(this._hmac_matches === undefined)
				this._hmac_matches = CompareWordArrays(this._hmac, this._hmac_stream.finalize());
			
			return this._hmac_matches;
		}
		else
			throw "Decryptor.ValidHMAC called before stream finished";
	}
}


export {
	CryptoJS,
	CompareWordArrays,
	XORWordArrays,
	SliceWordArray,
	ChopWordArray,
	ArrayBufferToWordArray,
	Uint8ArrayToWordArray,
	Uint8ArrayToLatin1,
	Latin1ToUint8Array,
	WordArrayToUint8Array,
	GenerateBaseKey,
	GenerateAccountID,
	GenerateMasterKey,
	GenerateBaseDataID,
	GenerateUniqueDataID,
	GenerateIV,
	GenerateEncryptionKey,
	ShortEncrypt,
	ShortDecrypt,
	CombineCipherIV,
	ChopCipherIV,
	CompleteShortEncrypt,
	CompleteShortDecrypt,
	Encryptor,
	Decryptor
};