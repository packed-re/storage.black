import {
	CryptoJS,
	Uint8ArrayToWordArray
} from "$lib"; 
import { api_base } from "$lib/networking";

// account hash expected to be WordArray
function CreateSession(account_hash, age = 60 * 60)
{
	let resolver;
	let promise = new Promise((resolve) => resolver = resolve);

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
			let encryption_key = Uint8ArrayToWordArray(new Uint8Array(buffer, 1 + 8));

			sessionStorage.setItem("session-key", encryption_key.toString(CryptoJS.enc.Base64));
			localStorage.setItem("session-expire-date", expire_date.toString()); // makes so much sense how the language of the web doesnt have a direct, built-in method of converting its designated structure for handling binary data to base64

			resolver(encryption_key);
		}
	});

	return promise;
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

function FetchEncryptionKey() // returns false if session isnt valid, wordarray if it is
{
	let resolver;
	let promise = new Promise((resolve) => resolver = resolve);

	if(CheckSession())
	{
		let encryption_key = sessionStorage.getItem("session-key");
		if(encryption_key !== null)
		{
			resolver(CryptoJS.enc.Base64.parse(encryption_key));
		}
		else
		{
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
		}
	}
	else
		resolver(false);

	return promise;
}

function ClearSession()
{
	sessionStorage.removeItem("session-key");
	localStorage.removeItem("session-expire-date");

	fetch(api_base + "session", {
		method: "DELETE",
		credentials: "include"
	});
}

export {
	CreateSession,
	CheckSession,
	FetchEncryptionKey,
	ClearSession
};