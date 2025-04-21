import {
	CryptoJS,
	SliceWordArray,
	ChopWordArray,
	ArrayBufferToWordArray,
	Uint8ArrayToWordArray,
	WordArrayToUint8Array,
	DataViewWriteUint8Array,
	SimpleEncrypt,
	SimpleDecrypt
} from "$lib";

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

function SendData(method, endpoint, uploadBlob) // resolves to status byte +  uint8array response
{
	return new Promise(function(resolve){

	});
}

function MakeFile(dataId, metadata, fileSize) // resolves to fileId word array
{
	return new Promise(function(resolve){
		let requestHeader = new DataView(new ArrayBuffer(MAKE_FILE_HEADER_MIN_SIZE + metadata.sigBytes));
		let uploadWordArray = new CryptoJS.lib.WordArray.init([], 0).concat(dataId).concat(fileSize).concat(metadata);
		DataViewWriteUint8Array(requestHeader, 0, WordArrayToUint8Array(uploadWordArray));

		SendData("POST", "makefile", new Blob([requestHeader])).then(function(status, response)
		{
			if(status === 1)
			{

			}
			else
				throw new Error("makefile request failed - " + new TextDecoder().decode(response))
		});
	});
}

function MakeMetadata(encryptionKey, name, isFolder)
{
	let encodedName = new TextEncoder().encode(name);
	if(encodedName.length > 191)
		throw new Error("File name can be at most 191 bytes, received " + encodedName.length.toString());

	let metadata = CryptoJS.lib.WordArray.init([isFolder ? 0x01000000 : 0], 1).concat(CryptoJS.lib.WordArray.random(16)).concat(Uint8ArrayToWordArray(encodedName));
	return SimpleEncrypt(metadata, encryptionKey);
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

	UploadChunk(chunkBlob)
	{
		return new Promise(function(resolve){
			let uploadBlob = new Blob([this.requestHeader, chunkBlob]);
			// encryption here
			SendData("POST", "file", uploadBlob).then(resolve);
		});
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
		return new Promise(function(resolve){
			SendData("GET", "file", new Blob([this.requestHeader])).then(function(status, response){
				if(status === 1)
					// decryption here
					resolve(Uint8ArrayToWordArray(response));
				else
					throw new Error("Chunk download request failed - " + new TextDecoder().decode(response));
			});
		})
	}
}


class NetworkedFile
{
	constructor(folderKey, fileId, metadata, fileSize) // everything is expected to be a word array
	{
		this.raw = {
			folderKey: folderKey,
			fileId: fileId,
			metadata: {
				value: metadata,
				key: CryptoJS.HmacSHA256(folderKey, fileId)
			},
			fileSize: fileSize,
			encryptionKeyRand: undefined,
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
		this.fileSize = Number(BigUint64Array(WordArrayToUint8Array(fileSize).buffer)[0]);		

		if(this.fileSize > Number.MAX_SAFE_INTEGER)
			throw new Error("NetworkFile currently doesn't support a fileSize larger than Number.MAX_SAFE_INTEGER");
	}



	Download() // return blob
	{
		return new Promise(function(resolve)
		{
			let downloadRequest = new FileDownloadRequest(this.raw.fileId, this.raw.fileSize, this.raw.encryptionKey);
			let finalBlob = new Blob();
			downloadRequest.DownloadChunk().then(function processChunk(downloadedBlob){
				finalBlob = new Blob([finalBlob, downloadedBlob]);
				if(downloadRequest.SetFileRangeNextChunk() !== true)
					return resolve(finalBlob);

				downloadRequest.DownloadChunk().then(processChunk);
			});
		});
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
			throw new Error("NetworkedFile is not a folder");
		
		if(netFile.fileSize != 32)
			throw new Error("NetworkedFile fileSize expected to be exactly 32 bytes, but received " + netFile.fileSize.toString());

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

	ListFiles() // 16 bytes fileId, 8 bytes fileSize, 1 byte to denote size of metadata, metadata
	{
		let listBuffer = Uint8ArrayToWordArray(new Uint8Array(100));

		let outputFiles = [];

		let fileObjBase = 0;
		while (fileObjBase < listBuffer.length)
		{
			let fileId = SliceWordArray(listBuffer, fileObjBase, fileObjBase + 16); // 16 bytes
			let fileSize = SliceWordArray(listBuffer, fileObjBase + 16, fileObjBase + 24); // 8 bytes
			let metadataLen = (SliceWordArray(listBuffer, fileObjBase + 24, fileObjBase + 25).words & 0xFF000000) >>> 24; // 24th byte

			if(metadataLen === 0)
				throw new Error(`metadata length byte is null. Object base - ${fileObjBase}`);

			if((fileObjBase + metadataLen) > listBuffer.length)
				throw new Error(`metadata length byte points outside the bounds of the list buffer. Object base - ${fileObjBase} | Object length - ${fileLen}`);

			if(metadataLen > 240)
				throw new Error(`metadata length is too long (>240). Object base - ${fileObjBase} | Object length - ${metadataLen}`);
			
			let metadata = SliceWordArray(listBuffer, fileObjBase + 25, fileObjBase + 25 + metadataLen);
			outputFiles.push(new NetworkedFile(this.folderKey, fileId, metadata, fileSize));
			fileObjBase += 25 + metadataLen;
		}

		return outputFiles;
	}

	UploadFile(file) // MakeFileRequest -> FileUploadRequest. Return NetworkedFile
	{
	
	}
	

	UploadFile(file)
	{
		return new Promise(async function(resolve){
			let metadata = MakeMetadata(this.folderKey, file.name, false);
			let fileId = MakeFile
			let uploadRequest = new FileUploadRequest(...);
			await MakeFileRequest(this.dataId)

			let fileReader = file.stream().getReader();
			let fileChunk = new Blob();
			fileReader.read().then(function processChunk({done, value}){
				if(done)
				{
					if(fileChunk.size != 0)
						return uploadRequest.UploadChunk(fileChunk).then(resolve)

					return resolve(true);
				}
				
				fileChunk = new Blob([fileChunk, value]);
				if(fileChunk.size >= FILE_TRANSFER_CHUNK_SIZE)
				{
					uploadRequest.UploadChunk(fileChunk);
					uploadRequest.SetFilePointer(uploadRequest.filePointer + fileChunk.size);
				}

				fileReader.read().then(processChunk);
			});
		})
		
	}
}