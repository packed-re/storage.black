import CryptoJS from "crypto-js";

function SetCookie(name, value="", age=0) {
	document.cookie = name + "=" + encodeURIComponent(value) + "; max-age=" + age;
}

function GetCookie(name) {
	let cookies = document.cookie.split(";");
    
	for(let i = 0; i < cookies.length; i++)
	{
		let cookiePair = cookies[i].split("=");
		if(cookiePair[0].trim() === name)
			return decodeURIComponent(cookiePair[1]);
	}
    
	return null;
}

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
function ChopWordArray(wa, start, end) // same as above but does the slicing on the given array, instead of a newly created one. it keeps whatever part was selected by start and end
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

		for(let i = 0; i < startWord; ++i)
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
function ArrayBufferToWordArray(arrayBuffer) // for the sake of speed, this destroys the input array buffer. If you need it for something else afterwards, you should pass this function a copy by doing .slice(0)
{
	let byteCount = arrayBuffer.byteLength;
	let words = [];

	let leftOverByteCount  = byteCount % 4;
	let dwordStride = byteCount - leftOverByteCount;

	let uint32_array;
	let leftOverBytes;
	if(leftOverByteCount !== 0)
	{
		leftOverBytes = new Uint8Array(arrayBuffer.slice(dwordStride));
		arrayBuffer = arrayBuffer.transfer(dwordStride);
	}

	uint32_array = new Uint32Array(arrayBuffer);
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
		let word_i = i >>> 2; // div by 4
		words[word_i] = (words[word_i] << 8) | uint8arr[i]; // if theres issues replace | with +																																																	// WARNING! WARNING! WARNING! CHROME IS FUCKING DOGSHIT AND WILL THROW A RANGEERROR AT AN ARBITRARY ARRAY LENGTH (50139473 when tested). BE EXCEPTIONALLY CAUTIOUS WITH CHROMIUM CLIENTS.
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

function WordArrayToUint8Array(wordArray)
{
	let byteCount = wordArray.sigBytes;
	let out = new Uint8Array(byteCount);

	for(let i = 0; i < byteCount; ++i)
	{
		out[i] = (wordArray.words[i >>> 2] >>> (24 - 8 * (i % 4))) & 0xFF;
	}

	return out;
}

function DataViewWriteUint8Array(dataView, offset, uint8Array)
{
	for(let i = 0; i < uint8Array.length; ++i)
		dataView.setUint8(offset + i, uint8Array[i]);
}

let _ArgonBaseKeySalt = WordArrayToUint8Array(CryptoJS.enc.Hex.parse("57d7f4ba75600c6992d9e0eb2e2f6b0e5b750276675cef0c9b112c54a2f1dd82"));
let _AccountIDSalt = CryptoJS.enc.Hex.parse("5d54dfe28d8adb0a63fff0e518db2bed2eaedef5fd34084bc14f328f21832ba0");
let _MasterKeySalt = CryptoJS.enc.Hex.parse("170a3530f5d5bde9156e86a539b1b7500b40b6a7caa163e0f819f2ce9745adb8");
let _BaseDataIDSalt = CryptoJS.enc.Hex.parse("a03a0527ac9c906ad6dde127c16413a003d5fbc299eeb1562133cb8f997d2bec");
let _BaseFolderKeySalt = CryptoJS.enc.Hex.parse("7650c988b786fc83e75709de37cba571dc305b4d9d4cdf52a947036774230056");

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

function GenerateAccountID(baseKey)
{
	return CryptoJS.HmacSHA256(baseKey, _AccountIDSalt);
}

function GenerateMasterKey(baseKey)
{
	return CryptoJS.HmacSHA256(baseKey, _MasterKeySalt);
}

function GenerateBaseDataID(baseKey)
{
	let hash = CryptoJS.HmacSHA256(baseKey, _BaseDataIDSalt);
	let firstHalf = SliceWordArray(hash, 0, 16); // i should make a function that skips the slicing part and directly xors halves, but im out of time so
	let secondHalf = SliceWordArray(hash, 16);
	
	return XORWordArrays(firstHalf, secondHalf);
}

function GenerateBaseFolderKeySalt(baseKey)
{
	return CryptoJS.HmacSHA256(baseKey, _BaseFolderKeySalt);
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

const CIPHER_PAD_SIZE = 16;
const CIPHER_HEADER_SIZE = 8 + 32 + CIPHER_PAD_SIZE;
const CIPHER_HEADER_SIZE_WITH_IV = CIPHER_HEADER_SIZE + 16;

// key needs to be of proper length otherwise SerializableCipher will break!!!! 
function ShortEncrypt(data, key, iv, padding = CryptoJS.pad.Pkcs7) // key is a WordArrays. data should be able to be both a WordArray and a string
{
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

	return hmac_secret_salt.concat(cipher_hmac).concat(ciphertext);
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

function CombineCipherIV(cipher, iv)
{
	return cipher.concat(iv);
}

function ChopCipherIV(cipher)
{
	let iv = SliceWordArray(cipher, cipher.sigBytes-16);
	ChopWordArray(cipher, 0, cipher.sigBytes-16);
	return iv;
}

function SimpleEncrypt(data, key, padding = CryptoJS.pad.Pkcs7)
{
	let iv = GenerateIV();
	return CombineCipherIV(ShortEncrypt(
		data, key, iv, padding
	), iv);
}

function SimpleDecrypt(data, key, padding = CryptoJS.pad.Pkcs7)
{
	let iv = ChopCipherIV(data);
	return ShortDecrypt(
		data, key, iv, padding
	);
}

function CalculatePaddedCipherLength(plaintextLen)
{
	let remainder = plaintextLen % CIPHER_PAD_SIZE;
	if(remainder === 0)
		return plaintextLen + CIPHER_PAD_SIZE;
	else
		return plaintextLen + (CIPHER_PAD_SIZE - remainder);
}

export {
	SetCookie,
	GetCookie,
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
	DataViewWriteUint8Array,
	GenerateBaseKey,
	GenerateAccountID,
	GenerateMasterKey,
	GenerateBaseDataID,
	GenerateBaseFolderKeySalt,	
	GenerateUniqueDataID,
	GenerateIV,
	GenerateEncryptionKey,
	CIPHER_PAD_SIZE,
	CIPHER_HEADER_SIZE,
	CIPHER_HEADER_SIZE_WITH_IV,
	ShortEncrypt,
	ShortDecrypt,
	CombineCipherIV,
	ChopCipherIV,
	SimpleEncrypt,
	SimpleDecrypt,
	CalculatePaddedCipherLength
};