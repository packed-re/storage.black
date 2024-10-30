import {
	CryptoJS,
	Uint8ArrayToWordArray,
	GenerateAccountID,
	GenerateMasterKey,
	GenerateBaseDataID,
	ShortEncrypt,
	ShortDecrypt,
	SimpleEncrypt,
	SimpleDecrypt,
	CombineCipherIV,
	ChopCipherIV
} from "$lib";

import { api_base } from "$lib/networking";

let session = { // not using sessionStorage because that writes to disk which could potentially be unsafe
	session_key: null,

	folder: {
		data_id: null,
		encryption_key: null
	}
};

// account hash expected to be WordArray
function CreateSession(base_key, age = 60 * 60)
{
	let account_hash = GenerateAccountID(base_key);
	let master_key = GenerateMasterKey(base_key);
	let base_data_id = GenerateBaseDataID(base_key);

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
				let expire_date = new DataView(buffer.slice(1, 9)).getBigUint64(0, true);
				session.session_key = Uint8ArrayToWordArray(new Uint8Array(buffer, 1 + 8));

				session.folder.data_id = base_data_id;
				session.folder.encryption_key = master_key;
	
				localStorage.setItem("session-expire-date", expire_date.toString());

				let data_id = SimpleEncrypt(
					base_data_id,
					session.session_key,
					CryptoJS.pad.NoPadding
				).toString(CryptoJS.enc.Base64);

				sessionStorage.setItem("data-id", data_id)
				localStorage.setItem("base-data-id", data_id);

				let encryption_key = SimpleEncrypt(
					master_key,
					session.session_key,
					CryptoJS.pad.NoPadding
				).toString(CryptoJS.enc.Base64);

				localStorage.setItem("master-key", encryption_key);
				sessionStorage.setItem("encryption-key", encryption_key);

				return resolver(true);
			}
			else
				return resolver(false);
		});
	});
}

function CheckSession()
{
	if(localStorage.getItem("base-data-id") === null || localStorage.getItem("master-key") === null)
		return false;
	
	let expire_date = localStorage.getItem("session-expire-date");

	if(expire_date === null)
		return false;

	if(BigInt(Math.floor(Date.now()/1000)) > BigInt(expire_date))
		return false;

	return true;
}

function LogOut()
{
	ClearSession().then(()=>window.location.replace("/login"));
}

function FetchSessionEncryptionKey() // returns false if session isnt valid, wordarray if it is
{
	return new Promise(function(resolver){
		if(!CheckSession())
			return resolver(false);
		
		if(session.session_key)
			return resolver(CryptoJS.enc.Base64.parse(session.session_key));

		fetch(api_base + "session", {
			method: "GET",
			credentials: "include"
		}).then(async function(response){
			let buffer = await response.arrayBuffer();
			let status = new Uint8Array(buffer, 0, 1)[0];
					
			if(status === 0) // success
			{
				session.session_key = Uint8ArrayToWordArray(new Uint8Array(buffer, 1));	
				resolver(session.session_key);
			}
			else
				resolver(null);
		});
	});
}

function ClearSession()
{
	return new Promise(function(resolver){
		session = {};
		
		sessionStorage.removeItem("data-id");
		sessionStorage.removeItem("encryption-key");
		localStorage.removeItem("session-expire-date");
		localStorage.removeItem("master-key");
		localStorage.removeItem("base-data-id");

		fetch(api_base + "session", {
			method: "DELETE",
			credentials: "include"
		})
		.then((response) => response.blob()) // when the response object is given, the request hasnt finished yet, so we wait again until it has
		.then(() => resolver());
	});	
}

function SetFolderData(data_id, encryption_key)
{
	return new Promise(function(resolver){
		FetchSessionEncryptionKey().then(function(session_key){
			if(session_key === null)
				return resolver(false);

			session.folder.data_id = data_id;
			session.folder.encryption_key = encryption_key;

			sessionStorage.setItem("data-id", SimpleEncrypt(
				data_id,
				session_key,
				CryptoJS.pad.NoPadding
			).toString(CryptoJS.enc.Base64));

			sessionStorage.setItem("encryption-key", SimpleEncrypt(
				encryption_key,
				session_key,
				CryptoJS.pad.NoPadding
			).toString(CryptoJS.enc.Base64));

			return resolver(true);
		});
	});
}

function ResetFolderData()
{
	return new Promise(function(resolver){
		FetchSessionEncryptionKey().then(function(session_key){
			if(session_key === null)
				return resolver(false);

			let master_key = localStorage.getItem("master-key");
			if(master_key === null)
				return resolver(false);

			let base_data_id = localStorage.getItem("base-data-id");
			if(base_data_id === null)
				return resolver(false);

			sessionStorage.setItem("encryption-key", master_key);
			sessionStorage.setItem("data-id", base_data_id);

			session.folder.encryption_key = SimpleDecrypt(
				CryptoJS.enc.Base64.parse(master_key),
				session_key,
				CryptoJS.pad.NoPadding
			);

			session.folder.data_id = SimpleDecrypt(
				CryptoJS.enc.Base64.parse(base_data_id),
				session_key,
				CryptoJS.pad.NoPadding
			);

			return resolver(true);
		});
	});
}

function GetCurrentFolderData()
{
	return session.folder;
}

function RebuildSession()
{
	return new Promise(function(resolver){
		FetchSessionEncryptionKey().then(function(session_key){
			if(session_key === null)
				return resolver(false);

			let encryption_key = sessionStorage.getItem("encryption-key");
			if(encryption_key === null)
			{
				encryption_key = localStorage.getItem("master-key");
				if(encryption_key === null)
					return resolver(false);
				else
					sessionStorage.setItem("encryption-key", encryption_key);
			}

			let data_id = sessionStorage.getItem("data-id");
			if(data_id === null)
			{
				data_id = localStorage.getItem("base-data-id");
				if(data_id === null)
					return resolver(false);
				else
					sessionStorage.setItem("data-id", data_id);
			}

			session.folder.encryption_key = SimpleDecrypt(
				CryptoJS.enc.Base64.parse(encryption_key),
				session_key,
				CryptoJS.pad.NoPadding
			);
	
			session.folder.data_id = SimpleDecrypt(
				CryptoJS.enc.Base64.parse(data_id),
				session_key,
				CryptoJS.pad.NoPadding
			);			

			return resolver(true);
		});
	});
}

export {
	CreateSession,
	CheckSession,
	LogOut,
	FetchSessionEncryptionKey,
	ClearSession,
	// StoreMasterKey,
	SetFolderData,
	ResetFolderData,
	GetCurrentFolderData,
	RebuildSession
};