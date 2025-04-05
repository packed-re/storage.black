import {
	CryptoJS,
	WordArrayToUint8Array,
	GenerateIV,
	GenerateEncryptionKey,
	CipherPadSize,
	CipherHeaderSize,
	CipherHeaderSizeWithIV,
	ShortEncrypt,
	ShortDecrypt,
	CombineCipherIV,
	ChopCipherIV,
	SimpleEncrypt,
	SimpleDecrypt,
	Encryptor
} from "$lib";

import {
	GetCurrentFolderData
} from "$lib/session";

import { api_base } from "$lib/networking";

const _base_header_len = 1 + 1 + 6 + 8 + 8 + 104 + 16; // this doesnt inluce file_data, which comes at the end of everything else
const _max_file_data_len = 255;
const _max_header_len = _base_header_len + _max_file_data_len;

const ActionType = {
	Download: 0,
	Upload: 1,
	Delete: 2
};

class SBFileHeader
{
	constructor(sbfile)
	{
		this.header_view = new DataView(new ArrayBuffer(_base_header_len + sbfile.file_data.sigBytes));

		this.header_view.setUint8(0, 0); // action_type
		this.header_view.setUint8(1, 0); // finished

		this.header_view.setBigUint64(8, BigInt(0), true); // offset
		this.header_view.setBigUint64(16, BigInt(sbfile.file_size), true); // file_size

		let encryption_data_u8_array = WordArrayToUint8Array(sbfile.encryption_data);
		for(let i = 0; i < 104; ++i)
			this.header_view.setUint8(24 + i, encryption_data_u8_array[i]); // encryption_data

		let data_id_u8_array = WordArrayToUint8Array(sbfile.data_id);
		for(let i = 0; i < 16; ++i)
			this.header_view.setUint8(128 + i, data_id_u8_array[i]); // data_id

		let file_data_u8_array = WordArrayToUint8Array(sbfile.file_data);
		for(let i = 0; i < file_data_u8_array.length; ++i)
			this.header_view.setUint8(144 + i, file_data_u8_array[i]); // file_data
	}

	SetActionType(action)
	{
		this.header_view.setUint8(0, action);
	}

	SetFinished(finished)
	{		
		this.header_view.setUint8(8, finished ? 1 : 0);
	}

	SetOffset(offset)
	{
		this.header_view.setBigUint64(8, offset, true); // offset
	}

	GetOffset()
	{
		return this.header_view.getBigUint64(8, true);
	}

	GetBuffer()
	{
		return this.header_view.buffer
	}
}

class SBFile
{
	constructor(create_obj)
	{
		Object.assign(this, create_obj);
		console.log(this)
	}

	static FromData(file_size, date, encryption_data, data_id, file_data, folder_key) // file_size, date, encryption_key, data_id, file_data
	{
		let obj = {};

		obj.file_size = // Math.ceil((file_size + 1) / 16) * 16; - 
		obj.date = date;
		obj.encryption_data = encryption_data;
		obj.data_id = data_id;
		obj.file_data = file_data;

		obj.decrypted_key = SimpleDecrypt(
			encryption_data,
			folder_key,
			CryptoJS.pad.NoPadding
		);

		obj.decryption_iv = ChopCipherIV(obj.decrypted_key); // this removes the iv from decrypted_key
		
		obj.info = { // this is done to keep a standardized place for lookup of the files data, incase the structure of the headers change
			name: ShortDecrypt,
			date: obj.date,
			size: file_size
		};

		return new SBFile(obj);
	}

	static FromFile(file, folder_data)
	{
		if(file.name.length + CipherHeaderSizeWithIV > _max_file_data_len)
			throw "File name too long";

		let obj = {};

		obj.file_size = file.size;
		obj.date = Date.now() / 1000; // atm this isnt really how its calculated on the server, but that should be fixed in the future
		obj.data_id = folder_data.data_id;

		obj.encryption_key = GenerateEncryptionKey();
		obj.encryption_iv = GenerateIV();

		obj.encryption_data = SimpleEncrypt(
			CombineCipherIV(
				obj.encryption_key,
				obj.encryption_iv
			),
			folder_data.encryption_key,
			CryptoJS.pad.NoPadding
		);

		obj.file_data = CombineCipherIV(ShortEncrypt(
			file.name,
			obj.encryption_key,
			obj.encryption_iv
		), obj.encryption_iv);

		obj.info = {
			name: file.name,
			date: obj.date,
			size: obj.file_size
		};
		console.log(obj);
		return new SBFile(obj);
	}

	GetRequestHeader()
	{
		if(this._header)
			return this._header;
		else
			return this._header = new SBFileHeader(this);
	}
}

function FetchFileList(folder_data)
{
	return new Promise(function(resolver){
		resolver(false);
		
		fetch(api_base + "file?data-id=" + folder_data.data_id.toString(CryptoJS.enc.Base64), {
			method: "GET",
			credentials: "include"
		}).then(async function(response){
			let response_buffer = await response.arrayBuffer();
			let status = new Uint8Array(response_buffer, 0, 1)[0];
				
			if(status === 0) // success
			{
				let read_chunk_size = new BigUint64Array(response_buffer.slice(1, 9))[0];
				let file_list_json = new TextDecoder().decode(new Uint8Array(response_buffer, 1 + 8));

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
					new TextDecoder().decode(new Uint8Array(response_buffer, 1))
				);
		});
	});
}

function UploadFile(file, folder_data)
{
	return new Promise(function(resolver){
		let sbfile = SBFile.FromFile(file, folder_data);
		let request_header = sbfile.GetRequestHeader();

		request_header.SetActionType(ActionType.Upload);
		request_header.SetFinished(false);
		request_header.SetOffset(BigInt(CipherHeaderSize));

		let chunk_size = 1_000_000;
		let encryptor = new Encryptor(file, chunk_size, sbfile.encryption_key, sbfile.encryption_iv);

		encryptor.EncryptChunk(function upload_data(ciphertext, done)
		{
			let header_buff = request_header.GetBuffer()
			let formData = new FormData();
			formData.set(
				"file",
				new Blob([header_buff, WordArrayToUint8Array(ciphertext)]),
				"file"
			);

			fetch(api_base + "file", {
				method: "POST",
				credentials: "include",
				body: formData,
				headers: {
					"sb-header-size": header_buff.byteLength
				}
			}).then(async function(response){
				let status = new Uint8Array(await response.arrayBuffer(), 0, 1)[0];

				if(status === 0)
				{
					if(!done)
					{
						request_header.SetOffset(BigInt(request_header.GetOffset() + BigInt(ciphertext.sigBytes)));
						encryptor.EncryptChunk(upload_data);
					}
					else
					{
						header_buff = request_header.GetBuffer();
						request_header.SetOffset(BigInt(0));
						formData.set(
							"",
							new Blob([header_buff, WordArrayToUint8Array(ciphertext.RetrieveHMAC())]),
							"file"
						);

						fetch(api_base + "file", {
							method: "POST",
							credentials: "include",
							body: formData,
							headers: {
								"sb-header-size": header_buff.byteLength
							}
						}).then(async function(response){
							let status = new Uint8Array(await response.arrayBuffer(), 0, 1)[0];

							return resolver(status === 0);
						})
					}
				}
				else
					return resolver(console.log("upload failed") || false)
			});
		});
	});
}

function DownloadFile(sbfile)
{

}

function DeleteFile(sbfile)
{

}

export {
	FetchFileList,
	UploadFile
};