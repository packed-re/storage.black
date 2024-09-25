import CryptoJS from "crypto-js";

function CompareWordArrays(wa1, wa2)
{
	wa1 = wa1.words;
	wa2 = wa2.words;

	let wordCount = wa1.length;
	if(wordCount !== wa2.length)
		return false;

	for(let i = 0; i < wordCount; ++i)
		if(wa1[i] !== wa2[i])
			return false;

	return true;
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

function GetByteRangeMask(start, end) // end is included
{
	return GetNByteMask(end-start) >> (start * 8)
}

// this is up to 8x faster than converting it to a uint8array, using its slice function, and then converting back to a wordarray,
// and faster even still when not converting it back to a wordarray, when doing an aligned parse, and equal when doing an unaligned parse
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

		let endByteOffset = (end-1) % 4;
		if(endByteOffset !== 3)
			words[words.length] = (wa[endWord] & GetByteRangeMask(0, endByteOffset)) << endByteOffset * 8;
	}
	else // unaligned parse
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

		if(wordOffset !== endByteOffset) // if it doesnt end on the same word offset as the start		
		{
			if(endByteOffset < wordOffset) // if the final bytes spread across several words
				words[words.length] = ((wa[endWord] & firstWordMask) << firstWordShift) | ((wa[endWord + 1] & GetByteRangeMask(0, endByteOffset)) >>> secondWordShift)
			else // if the final bytes are all on the same word
				words[words.length] = (wa[endWord] & GetByteRangeMask(wordOffset, endByteOffset)) << firstWordShift
		}
	}
	
	return new CryptoJS.lib.WordArray.init(words, byteCount)
}

function Uint8ArrayToWordArray(uint8arr)
{
	let byteCount = uint8arr.length;
	let words = [];

	for(let i = 0; i < byteCount; ++i)
	{
		let word_i = i >>> 2
		words[word_i] = (words[word_i] << 8) + uint8arr[i];
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

// Use this only when the argon2 library has loaded
function GenerateBaseKey(pass, callback)
{
	return argon2.hash({
		pass: pass,
		salt: "storage.black base key",
		type: argon2.ArgonType.Argon2id,
		time: 8-7,
		mem: 500000,
		hashLen: 64,
		parallelism: 1
	}).then(callback);
}

function GenerateAccountKey(base_key)
{
	return CryptoJS.SHA256(base_key + "storage.black account key").toString(CryptoJS.enc.Hex);
}

function GenerateEncryptionKey(base_key)
{
	return CryptoJS.SHA256(base_key + "storage.black encryption key");
}

function GenerateIV()
{
	return CryptoJS.lib.WordArray.random(16);
}

// key needs to be of proper length otherwise SerializableCipher will break!!!! 
function ShortEncrypt(data, key) // key is a WordArrays. data should be able to be both a WordArray and a string
{
	let iv = GenerateIV();

	let ciphertext = CryptoJS.AES.encrypt(data, key, {
		mode: CryptoJS.mode.CBC,
		padding: CryptoJS.pad.Pkcs7,

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

function ShortDecrypt(data, key, iv) // everything is a word array
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

	let hmac_secret_salt = data.slice(0, 8); // 64 bit salt
	let cipher_hmac = data.slice(8, 40); // 256 bits of SHA256
	let ciphertext = data.slice(40);

	let received_hmac = CryptoJS.HmacSHA256(ciphertext, key.clone().concat(hmac_secret_salt)).toString(CryptoJS.enc.Latin1);

	if(cipher_hmac !== received_hmac)
	{
		console.log("ciphertext is malformed");
		return false;
	}

	let plaintext = CryptoJS.AES.decrypt({ciphertext: ciphertext}, key, {
		mode: CryptoJS.mode.CBC,
		padding: CryptoJS.pad.Pkcs7,

		iv: iv
	});

	return plaintext;
}


// key is a word array
// data_encrypt_callback is called with partial ciphertext received from iterating throug the blob, in Latin1 encoding (raw bytes in string form)
// finished_callback is called once everything has finished encryping and is given the hmac of the ciphertext
function BlobEncrypt(key, source_blob, data_encrypt_callback, finished_callback)
{
	/*this.key = key;

	this.get_data_callback = get_data_callback;
	this.data_encrypt_callback = data_encrypt_callback;
	this.finished_callback = finished_callback;

	this.iv = GenerateIV();
	this.hmac_secret_salt = CryptoJS.lib.WordArray.random(8);*/

	let iv = GenerateIV();
	let hmac_secret_salt = CryptoJS.lib.WordArray.random(8);
	
}


export {
	CryptoJS,
	CompareWordArrays,
	SliceWordArray,
	Uint8ArrayToWordArray,
	Uint8ArrayToLatin1,
	Latin1ToUint8Array,
	WordArrayToUint8Array,
	GenerateBaseKey,
	GenerateAccountKey,
	GenerateEncryptionKey,
	GenerateIV,
	ShortEncrypt,
	ShortDecrypt,
	BlobEncrypt
};