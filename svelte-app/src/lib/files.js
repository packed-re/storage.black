import {
	CryptoJS,
	ShortEncrypt,
	ShortDecrypt,
	ChopCipherIV,
	CompleteShortEncrypt,
	CompleteShortDecrypt
} from "$lib";

import {
	GetMasterKey,
	GetCurrentDataID
} from "$lib/session";

import { api_base } from "$lib/networking";

class SBFile
{
	constructor(file_size, date, encryption_key, data_id, file_data, decryption_key) // file_size, date, encryption_key, data_id, file_data
	{
		this.file_size = file_size;
		this.date = date;
		this.encryption_key = encryption_key;
		this.data_id = data_id;
		this.file_data = file_data;

		this.decrypted_key = CompleteShortDecrypt(
			encryption_key,
			decryption_key,
			CryptoJS.pad.NoPadding
		);

		this.decrypted_iv = ChopCipherIV(this.decrypted_key); // this removes the iv from decrypted_key
		
		this.info = {
			name: ShortDecrypt,
			date: null,
			size: null
		};
	}
}

function FetchFileList()
{
	return new Promise(function(resolver){
		GetMasterKey().then(function(){
			fetch(api_base + "file?data-id=" + GetCurrentDataID().toString(CryptoJS.enc.Base64), {
				method: "GET",
				credentials: "include"
			}).then(async function(response){
				let response_buffer = await response.arrayBuffer();
				let status = new Uint8Array(response_buffer, 0, 1)[0];
				
				if(status === 0) // success
				{
					let read_chunk_size = new BigUint64Array(response_buffer.slice(1, 9))[0];
					let file_list_json = new TextDecoder.decode(new Uint8Array(response_buffer, 1 + 8));

					let file_list;
					try {
						file_list = JSON.parse(file_list_json);
					}
					catch(ex) {
						file_list = null;
					}

					return resolver(true, read_chunk_size, file_list);
				}
				else
					return resolver(
						false,
						status,
						new TextDecoder.decode(new Uint8Array(response_buffer, 1))
					);
			});
		})
	});
}

export {
	FetchFileList
};