import {
	CryptoJS,
	SliceWordArray,
	ChopWordArray,
	ArrayBufferToWordArray,
	Uint8ArrayToWordArray,
	WordArrayToUint8Array,
	DataViewWriteUint8Array,
	GenerateIV,
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

function SendData(method, endpoint, uploadBlob) // resolves to {status, response} response is uint8array
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

		SendData("POST", "makefile", new Blob([requestHeader])).then(function({status, response})
		{
			if(status === 1)
				resolve(Uint8ArrayToWordArray(response));
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

class FileMetadata
{
	constructor(name, fileKeySalt, fileIv, isFolder, folderKey)
	{
		this.name = name;
		this.fileKeySalt = fileKeySalt;
		this.fileIv = fileIv;
		this.isFolder = isFolder;
		this.folderKey = folderKey;
		this.fileKey = CryptoJS.HmacSHA256(folderKey, fileKeySalt);

		this.GenerateDataBlock();
	}

	static Make(name, isFolder, folderKey)
	{
		return new FileMetadata(name, CryptoJS.lib.WordArray.random(16), CryptoJS.lib.WordArray.random(16), isFolder, folderKey);
	}

	static FromDataBlock(metadata, folderKey)
	{
		let decryptedBlock = SimpleDecrypt(metadata, folderKey);
		let isFolder = decryptedBlock.words[0] >>> 24 === 1;
		let fileKeySalt = SliceWordArray(decryptedBlock, 1, 17);
		let fileIv = SliceWordArray(decryptedBlock, 17, 33);
		let name = new TextDecoder().decode(WordArrayToUint8Array(ChopWordArray(decryptedBlock, 33)));

		return new FileMetadata(name, fileKeySalt, fileIv, isFolder, folderKey);
	}

	GenerateDataBlock()
	{
		let encodedName = new TextEncoder().encode(name);
		if(encodedName.length > 191)
			throw new Error("File name can be at most 191 bytes, received " + encodedName.length.toString());

		this.dataBlock = SimpleEncrypt(
			CryptoJS.lib.WordArray.init([isFolder ? 0x01000000 : 0], 1).concat(this.fileKeySalt).concat(this.fileIv).concat(Uint8ArrayToWordArray(encodedName)), 
			encryptionKey
		);
	}

	SetName(name)
	{
		this.name = name;
		this.GenerateDataBlock();
	}
}

class FileTransferBase
{
	constructor(requestHeader, fileId, fileSize, encryptionKey)
	{
		this.requestHeader = requestHeader; // new DataView(new ArrayBuffer(MAKE_FILE_HEADER_MIN_SIZE + metadata.sigBytes));
		this.fileId = fileId;
		this.fileSize = fileSize;
		this.encryptionKey = encryptionKey;

		DataViewWriteUint8Array(this.requestHeader, 0, this.fileId);
		this.requestHeader.setBigUint64(128, BigInt(this.fileSize), true);
	}
}

class FileUploader extends FileTransferBase
{
	constructor(fileId, fileSize, encryptionKey, encryptionIv)
	{
		super(new DataView(new ArrayBuffer(FILE_UPLOAD_HEADER_SIZE)), fileId, fileSize, encryptionKey);
		this.SetFilePointer(0);

		this.encryptor = CryptoJS.algo.AES.createEncryptor(encryptionKey, {
			mode: CryptoJS.mode.CBC,
			padding: CryptoJS.pad.Pkcs7,
			iv: encryptionIv
		});
	}

	SetFilePointer(newFilePointer)
	{		
		if(newFilePointer > Number.MAX_SAFE_INTEGER)
			throw new RangeError("file pointer values higher than Number.MAX_SAFE_INTEGER are currently unsupported");

		if(newFilePointer < 0)
			throw new Error("file pointer can't be negative");

		this.requestHeader.setBigUint64(136 /* 128 + 8 */, BigInt(this.filePointer = newFilePointer));
	}

	UploadChunk(chunkBuffer)
	{
		return new Promise(function(resolve){
			let uploadBlob = new Blob([this.requestHeader, this.encryptor.process(Uint8ArrayToWordArray(chunkBuffer))]);

			SendData("POST", "file", uploadBlob).then(function({status, response}){
				if(status !== 1)
					throw new Error("Chunk download request failed - " + new TextDecoder().decode(response));
				else
					resolve(true);
			});
		});
	}

	UploadFinalChunk(chunkBuffer)
	{
		return UploadChunk(this.encryptor.process(Uint8ArrayToWordArray(chunkBuffer).concat(this.encryptor.finalize()))); 
	}
}

class FileDownloader extends FileTransferBase
{
	constructor(fileId, fileSize, encryptionKey, encryptionIv)
	{
		super(new DataView(new ArrayBuffer(FILE_DOWNLOAD_HEADER_SIZE)), fileId, fileSize, encryptionKey);
		this.SetFileRange(0, Math.min(this.fileSize, FILE_TRANSFER_CHUNK_SIZE));

		this.decryptor = CryptoJS.algo.AES.createDecryptor(encryptionKey, {
			mode: CryptoJS.mode.CBC,
			padding: CryptoJS.pad.Pkcs7,			
			iv: encryptionIv
		});
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
			SendData("GET", "file", new Blob([this.requestHeader])).then(function({status, response}){
				if(status === 1)
					resolve(WordArrayToUint8Array(this.decryptor.process(Uint8ArrayToWordArray(response))));
				else
					throw new Error("Chunk download request failed - " + new TextDecoder().decode(response));
			});
		})
	}

	FinalizeDownload()
	{
		return WordArrayToUint8Array(this.decryptor.finalize());
	}
}


class NetworkedFile
{
	constructor(folderKey, fileId, fileSize, metadata) // everything except metadata is expected to be a word array
	{
		this.fileId = fileId;
		this.fileSize = fileSize;
		this.fileSizeNum = Number(BigUint64Array(WordArrayToUint8Array(this.fileSize).buffer)[0]);
		this.metadata = FileMetadata.FromDataBlock(metadata, folderKey);		

		if(this.fileSizeNum > Number.MAX_SAFE_INTEGER)
			throw new Error("NetworkFile currently doesn't support a fileSize larger than Number.MAX_SAFE_INTEGER");

		this._deleted = false;
	}

	Download() // return blob
	{
		if(this._deleted)
			throw new Error("Attempted to download deleted file");

		return new Promise(function(resolve)
		{
			let fileDownloader = new FileDownloader(this.fileId, this.fileSize, this.metadata.fileKey);
			let finalBlob = new Blob();
			fileDownloader.DownloadChunk().then(function processChunk(downloadedBuffer){
				finalBlob = new Blob([finalBlob, downloadedBuffer]);
				if(fileDownloader.SetFileRangeNextChunk() !== true)
					return resolve(new Blob([finalBlob, fileDownloader.FinalizeDownload()]));

				fileDownloader.DownloadChunk().then(processChunk);
			});
		});
	}

	Rename() // void, throw on failure
	{
		throw new Error("not implemented yet");
	}

	Delete() // void, throw on failure
	{
		return new Promise(function(resolve){
			SendData("DELETE", "file", new Blob([WordArrayToUint8Array(this.fileId)])).then(function({status}){
				if(status === 1)
					resolve(this._deleted = true);
				else
					throw new Error(`Failed to delete file ${metadata.name} (${this.fileId.toString(CryptoJS.enc.Hex)})`);
			})
		})		
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
		if(netFile.metadata.isFolder !== true)
			throw new Error("NetworkedFile is not a folder");
		
		if(netFile.fileSizeNum != 32)
			throw new Error("NetworkedFile fileSize expected to be exactly 32 bytes, but received " + netFile.fileSizeNum.toString());

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
			let metadataLen = SliceWordArray(listBuffer, fileObjBase + 24, fileObjBase + 25).words[0] >>> 24; // 24th byte

			if(metadataLen === 0)
				throw new Error(`metadata length byte is null. Object base - ${fileObjBase}`);

			if((fileObjBase + metadataLen) > listBuffer.length)
				throw new Error(`metadata length byte points outside the bounds of the list buffer. Object base - ${fileObjBase} | Object length - ${fileLen}`);

			if(metadataLen > 240)
				throw new Error(`metadata is too long (>240). Object base - ${fileObjBase} | Object length - ${metadataLen}`);
			
			let metadata = SliceWordArray(listBuffer, fileObjBase + 25, fileObjBase + 25 + metadataLen);
			outputFiles.push(new NetworkedFile(this.folderKey, fileId, fileSize, FileMetadata.FromDataBlock(metadata)));
			fileObjBase += 25 + metadataLen;
		}

		return outputFiles;
	}	

	UploadFile(file) // MakeFile -> FileUploadRequest. Return NetworkedFile
	{
		return new Promise(async function(resolve)
		{
			let metadata = FileMetadata.Make(file.name, false, this.folderKey);
			let fileSize = ArrayBufferToWordArray(BigUint64Array.of(BigInt(file.size)).buffer);
			let fileId = await MakeFile(this.dataId, metadata.dataBlock, fileSize);
			let fileUploader = new FileUploader(fileId, fileSize, metadata.fileKey);

			let fileReader = file.stream().getReader();
			let fileChunk = new Uint8Array(0);//new Blob();
			fileReader.read().then(async function processChunk({done, value})
			{
				if(done)
				{
					let finalChunk;
					if(fileChunk.length != 0)
						finalChunk = fileChunk
					else
						finalChunk = new Uint8Array(0);
					
					return fileUploader.UploadFinalChunk(finalChunk).then(resolve);
				}
				
				let oldFileChunk = fileChunk;
				fileChunk = new Uint8Array(oldFileChunk.length + value.length);
				fileChunk.set(oldFileChunk); //new Blob([fileChunk, value]);
				fileChunk.set(value, oldFileChunk.length);
				oldFileChunk = undefined;

				if(fileChunk.size >= FILE_TRANSFER_CHUNK_SIZE)
				{
					await fileUploader.UploadChunk(fileChunk);
					fileUploader.SetFilePointer(fileUploader.filePointer + fileChunk.size);
					fileChunk = new Uint8Array(0);
				}

				fileReader.read().then(processChunk);
			});
		});
	}
}