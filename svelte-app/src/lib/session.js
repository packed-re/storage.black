import {
	CryptoJS,
	Uint8ArrayToWordArray,
	ShortEncrypt,
	ShortDecrypt,
	CombineCipherIV,
	ChopCipherIV
} from "$lib";

import { api_base } from "$lib/networking";

// account hash expected to be WordArray
function CreateSession(account_hash, master_key, age = 60 * 60)
{
	return new Promise(function(resolver){
		fetch(api_base + "session", {
			method: "POST",
			credentials: "include",
			body: JSON.stringify({
				age: age,
				account_id: account_hash.toString(CryptoJS.enc.Base64)
			})
		}).then(async function(response){
			let buffer = await response.arrayBuffer();
			let status = new Uint8Array(buffer, 0, 1)[0];
			
			if(status === 0) // success
			{
				let expire_date = new BigUint64Array(buffer.slice(1, 9))[0];
				let session_encryption_key = Uint8ArrayToWordArray(new Uint8Array(buffer, 1 + 8));
	
				sessionStorage.setItem("session-key", session_encryption_key.toString(CryptoJS.enc.Base64));
				localStorage.setItem("session-expire-date", expire_date.toString()); // makes so much sense how the language of the web doesnt have a direct, built-in method of converting its designated structure for handling binary data to base64
				
				StoreMasterKey(master_key);

				return resolver(session_encryption_key);
			}
		});
	});
}

function CheckSession()
{
	let expire_date = localStorage.getItem("session-expire-date");

	if(expire_date === null)
		return false;

	if(BigInt(Math.floor(Date.now()/1000)) > BigInt(expire_date))
		return false;

	return true;
}

function FetchSessionEncryptionKey() // returns false if session isnt valid, wordarray if it is
{
	return new Promise(function(resolver){
		if(!CheckSession())
			return resolver(false);
		
		let encryption_key = sessionStorage.getItem("session-key");
		if(encryption_key !== null)
			return resolver(CryptoJS.enc.Base64.parse(encryption_key));

		fetch(api_base + "session", {
			method: "GET",
			credentials: "include"
		}).then(async function(response){
			let buffer = await response.arrayBuffer();
			let status = new Uint8Array(buffer, 0, 1)[0];
					
			if(status === 0) // success
			{
				encryption_key = Uint8ArrayToWordArray(new Uint8Array(buffer, 1));
				sessionStorage.setItem("session-key", encryption_key.toString(CryptoJS.enc.Base64));
	
				resolver(encryption_key);
			}
			else
				resolver(false);
		});
	});
}

function ClearSession()
{
	return new Promise(function(resolver){
		sessionStorage.removeItem("session-key");
		localStorage.removeItem("session-expire-date");
		localStorage.removeItem("master-key");

		fetch(api_base + "session", {
			method: "DELETE",
			credentials: "include"
		})
		.then((response) => response.blob()) // when the response object is given, the request hasnt finished yet, so we wait again until it has
		.then(() => resolver());
	})
	
}

function StoreMasterKey(master_key)
{
	FetchSessionEncryptionKey().then(function(session_key){
		if(session_key)
		{
			localStorage.setItem("master-key", CombineCipherIV(ShortEncrypt(
				master_key,
				session_key,
				CryptoJS.pad.NoPadding
			)).toString(CryptoJS.enc.Base64))
		}
	});
}

function GetMasterKey()
{
	return new Promise(function(resolver){
		let key = localStorage.getItem("master-key");
		if(key === null)
			return resolver(key);

		FetchSessionEncryptionKey().then(function(session_key){
			if(session_key)
			{
				let cipher = CryptoJS.enc.Base64.parse(key);
				let iv = ChopCipherIV(cipher);

				resolver(
					ShortDecrypt(
						cipher,
						session_key,
						iv,
						CryptoJS.pad.NoPadding
					)
				);
			}
			else
				return resolver(null);
		});
	});
}

export {
	CreateSession,
	CheckSession,
	FetchSessionEncryptionKey,
	ClearSession,
	StoreMasterKey,
	GetMasterKey
};