import {
	SliceWordArray,
	ChopWordArray,
	ArrayBufferToWordArray,
	Uint8ArrayToWordArray,
	WordArrayToUint8Array,
	DataViewWriteUint8Array,
	SimpleEncrypt,
	SimpleDecrypt
} from "$lib";

import CryptoJS from "crypto-js";
import { ArrayBufferToWordArray, ChopWordArray, SliceWordArray } from ".";

const API_BASE = "http://localhost/api/v1/"; 

const MAKE_FILE_HEADER_MIN_SIZE = 128 + 8; // dataId + fileSize | + metadata
const FILE_UPLOAD_HEADER_SIZE = 128 + 8 + 8; // fileId + fileSize + filePointer
const FILE_DOWNLOAD_HEADER_SIZE = 128 + 8 + 8 + 8; // fileId + fileSize + rangeStart + rangeEnd
const FILE_TRANSFER_CHUNK_SIZE = 1_000_000; // 1 MB

let GlobalState = undefined;

function SetGlobalState(masterKey)
{
	GlobalState = {
		masterKey: masterKey
	};
}

function RetrieveGlobalState() // returns bool based on if one is active
{

}

function Login(passkey)
{

}

class MakeFileRequest
{
	constructor(dataId, metadata, fileSize)
	{
		this.requestHeader = new DataView(new ArrayBuffer(MAKE_FILE_HEADER_MIN_SIZE + metadata.sigBytes));

		DataViewWriteUint8Array(this.requestHeader, 0, WordArrayToUint8Array(dataId));
		this.requestHeader.setBigUint64(128, fileSize, true);
		DataViewWriteUint8Array(this.requestHeader, 128 + 8, WordArrayToUint8Array(fileSize));
	}

	Send()
	{

	}
}

class FileTransferRequestBase
{
	constructor(requestHeader, fileId, fileSize, encryptionKey)
	{
		this.requestHeader = requestHeader; //new DataView(new ArrayBuffer(MAKE_FILE_HEADER_MIN_SIZE + metadata.sigBytes));
		this.fileId = fileId;
		this.fileSize = fileSize;
		this.encryptionKey = encryptionKey;

		DataViewWriteUint8Array(this.requestHeader, 0, this.fileId);
		this.requestHeader.setBigUint64(128, BigInt(this.fileSize), true);
	}
}

class FileUploadRequest extends FileTransferRequestBase
{
	constructor(fileId, fileSize, encryptionKey, file)
	{
		super(new DataView(new ArrayBuffer(FILE_UPLOAD_HEADER_SIZE)), fileId, fileSize, encryptionKey);
		this.file = file;

		this.lastChunk = false;
		this.SetFilePointer(0);
	}

	SetFilePointer(newFilePointer)
	{		
		if(newFilePointer > Number.MAX_SAFE_INTEGER)
			throw new RangeError("file pointer values higher than Number.MAX_SAFE_INTEGER are currently unsupported");

		if(newFilePointer < 0)
			throw new Error("file pointer can't be negative");

		this.requestHeader.setBigUint64(136 /* 128 + 8 */, BigInt(this.filePointer = newFilePointer));
	}

	SetFilePointerNextChunk()
	{
		if(this.lastChunk === true)
			return false;
		
		let nextChunk = this.filePointer + FILE_TRANSFER_CHUNK_SIZE;
		if(nextChunk >= this.fileSize)
		{
			this.lastChunk = true;
			nextChunk = this.fileSize;
		}
		
		this.SetFilePointer(nextChunk);
		return true;
	}

	UploadChunk()
	{
		
	}
}

class FileDownloadRequest extends FileTransferRequestBase
{
	constructor(fileId, fileSize, encryptionKey)
	{
		super(new DataView(new ArrayBuffer(FILE_DOWNLOAD_HEADER_SIZE)), fileId, fileSize, encryptionKey);

		this.maxDownload = maxDownload;

		// this sets fileDownloadFrom and fileDownloadTo
		this.SetFileRange(0, Math.min(this.fileSize, FILE_TRANSFER_CHUNK_SIZE));
	}

	SetFileRange(from, to)
	{		
		if(from > Number.MAX_SAFE_INTEGER || to > Number.MAX_SAFE_INTEGER)
			throw new RangeError("file range values higher than Number.MAX_SAFE_INTEGER are currently unsupported");

		if(from < 0 || to < 1)
			throw new Error("file range values can't be negative");

		if(from >= to)
			throw new Error("file range from >= to");

		this.requestHeader.setBigUint64(136 /* 128 + 8 */, BigInt(this.fileDownloadFrom = from));
		this.requestHeader.setBigUint64(144 /* 128 + 16*/, BigInt(this.fileDownloadTo = to));
	}

	SetFileRangeNextChunk()
	{
		if(this.fileDownloadTo === this.fileSize)
			return false;

		this.SetFileRange(this.fileDownloadTo, Math.min(this.fileDownloadTo + FILE_TRANSFER_CHUNK_SIZE, this.fileSize));
		return true;
	}

	DownloadChunk()
	{
		
	}
}


class NetworkedFile
{
	constructor(folderKey, fileId, metadata) // everything is expected to be a word array
	{
		this.raw = {
			folderKey: folderKey,
			fileId: fileId,
			metadata: {
				value: metadata,
				key: CryptoJS.HmacSHA256(folderKey, fileId)
			},
			encryptionKey: undefined
		};

		let metadataPlain = SimpleDecrypt(this.metadata.value, this.metadata.key);
		if((metadataPlain.words[0] & 0xFF000000) >>> 24 == 0) // first byte, the folder flag
			this.isFolder = false;
		else
			this.isFolder = true;

		this.raw.encryptionKeyRand = SliceWordArray(this.metadataPlain, 1, 17);
		this.raw.encryptionKey = CryptoJS.HmacSHA256(folderKey, this.encryptionKeyRand);

		this.name = new TextDecoder().decode(WordArrayToUint8Array(SliceWordArray(this.metadataPlain, 17)));
	}



	Download() // return blob
	{
		return new Promise();
	}

	Rename() // void, throw on failure
	{
		throw new Error("not implemented yet");
	}

	Delete() // void, throw on failure
	{

	}
}

class FolderState
{
	constructor(dataId, folderKey, name = "") // both should be word arrays
	{
		this.dataId = dataId;
		this.folderKey = folderKey;

		this.name = name;
	}

	static FromNetworkedFile(netFile) // this will probably require a promise as it will have to download the folder data
	{
		if(netFile.isFolder !== true)
			throw new Error("NetworkedFile given to FolderState.FromNetworkedFile is not a folder");

		return new Promise(function(resolve){
			netFile.Download().then(function(blob){
				let data = ArrayBufferToWordArray(blob.arrayBuffer());

				let keySalt = SliceWordArray(data, 16);
				let dataId = ChopWordArray(data, 0, 16);

				resolve(new FolderState(
					dataId,
					CryptoJS.HmacSHA256(
						new CryptoJS.lib.WordArray.init([], 0).concat(GlobalState.masterKey).concat(dataId),
						keySalt
					)
				));
			});
		});
	}

	ListFiles()
	{
		let listBuffer = new Uint8Array(100);

		let outputFiles = [];

		let fileObjBase = 0;
		while (fileObjBase < listBuffer.length)
		{
			let fileLen = listBuffer[fileObjBase] + 1; // + 1 because it doesn't include the length byte

			if(fileLen === 1)
				throw new Error(`File object length in list buffer is null. Object base - ${fileObjBase}`);

			if((fileObjBase + fileLen) > listBuffer.length)
				throw new Error(`File object length points outside the bounds of the list buffer. Object base - ${fileObjBase} | Object length - ${fileLen}`);

			if(fileLen > 240)
				throw new Error(`File object length in list buffer is too long (>240). Object base - ${fileObjBase} | Object length - ${fileLen}`);

			let fileData = listBuffer.slice(fileObjBase, fileObjBase + fileLen);
			let fileId = Uint8ArrayToWordArray(fileData.slice(0, 16));
			let metadata = Uint8ArrayToWordArray(fileData.slice(16));

			outputFiles.push(new NetworkedFile(this.folderKey, fileId, metadata));
			fileObjBase += fileLen;
		}

		return outputFiles;
	}

	UploadFile(file) // MakeFileRequest -> FileUploadRequest. Return NetworkedFile
	{
	
	}
}