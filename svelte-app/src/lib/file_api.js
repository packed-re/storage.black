import {
	SetCookie,
	GetCookie,
	CryptoJS,
	SliceWordArray,
	ChopWordArray,
	ArrayBufferToWordArray,
	Uint8ArrayToWordArray,
	Latin1ToUint8Array,
	WordArrayToUint8Array,
	DataViewWriteUint8Array,
	GenerateBaseKey,
	GenerateAccountID,
	GenerateMasterKey,
	GenerateBaseDataID,
	GenerateBaseFolderKeySalt,
	GenerateIV,
	GenerateEncryptionKey,
	SimpleEncrypt,
	SimpleDecrypt
} from "$lib";

const API_BASE = "http://localhost/api/v2/";
const ENDPOINT_POSTFIX = ".php";

const MAKE_FILE_HEADER_MIN_SIZE = 128 + 8; // dataId + fileSize | + metadata
const FILE_UPLOAD_HEADER_SIZE = 128 + 8 + 8; // fileId + fileSize + filePointer
const FILE_DOWNLOAD_HEADER_SIZE = 128 + 8 + 8 + 8; // fileId + fileSize + rangeStart + rangeEnd
const FILE_TRANSFER_CHUNK_SIZE = 1_000_000; // 1 MB

function SendData(method, endpoint, uploadBlob) // resolves to {status, response} response is uint8array
{
	return new Promise(function(resolve){
		let request = new XMLHttpRequest();
		request.withCredentials = true;
		request.responseType = "arraybuffer"
		request.open(method, API_BASE + endpoint + ENDPOINT_POSTFIX);
		let formData = null;
		if(uploadBlob)
		{
			formData = new FormData();
			formData.set("data", uploadBlob);
		}
		request.send(formData);
		request.addEventListener("readystatechange", async function(event)
		{
			if(request.readyState === XMLHttpRequest.DONE)
			{
				let data;
				if(request.responseType === "arraybuffer")
					data = new Uint8Array(request.response);
				else
					throw new Error("Received unknown response type - " + request.responseType);

				resolve({
					status: data[0],
					data: data.slice(1)
				});
			}
		});
	});
}

function ClearSession()
{
	return new Promise(async function(resolve){
		SetCookie("innerKey");
		localStorage.removeItem("outterKey");
		localStorage.removeItem("innerKey");
		await SendData("DELETE", "session");
		resolve();
	});	
}


function LoadSession() // returns bool based on if one is active. if it is it calls GlobalState
{
	return new Promise(async function(resolve){
		let innerKeyB64 = GetCookie("innerKey");
		if(innerKeyB64 === null)
		{
			await ClearSession();
			return resolve(false);
		}
	
		let outterKeyB64 = localStorage.getItem("outterKey");
		if(outterKeyB64 === null)
		{
			await ClearSession();
			return resolve(false);
		}

		let sessionDataB64 = localStorage.getItem("sessionData");
		if(sessionDataB64 === null)
		{
			await ClearSession();
			return resolve(false);
		}

		let innerKey = SimpleDecrypt(CryptoJS.enc.Base64.parse(innerKeyB64), CryptoJS.enc.Base64.parse(outterKeyB64));

		let response = await SendData("GET", "session");
		if(response.status !== 0)
		{
			await ClearSession();
			return resolve(false);
		}

		resolve(SessionData.FromDataBlock(CryptoJS.enc.Base64.parse(sessionDataB64), Uint8ArrayToWordArray(response.data), innerKey));
	});	
}

function Login(passkey)
{
	return new Promise(function(resolve){
		GenerateBaseKey(passkey).then(async function(data){
			let baseKey = Uint8ArrayToWordArray(data.hash);
			let accountId = GenerateAccountID(baseKey);			
	
			let response = await SendData("POST", "session", new Blob([WordArrayToUint8Array(accountId)]));
			if(response.status !== 0)
				throw new Error("Failed to create new session");

			resolve(SessionData.Make(baseKey, Uint8ArrayToWordArray(response.data.slice(8, 40)), response.data.slice(0, 8)));
		});
	});
}

function MakeFile(dataId, metadata, fileSize) // resolves to fileId word array
{
	return new Promise(function(resolve){
		let requestHeader = new DataView(new ArrayBuffer(MAKE_FILE_HEADER_MIN_SIZE + metadata.sigBytes));
		let uploadWordArray = new CryptoJS.lib.WordArray.init([], 0).concat(dataId).concat(fileSize).concat(metadata); // 16 + 8 + >0 <=240
		DataViewWriteUint8Array(requestHeader, 0, WordArrayToUint8Array(uploadWordArray));

		SendData("POST", "makefile", new Blob([requestHeader])).then(function({status, response})
		{
			if(status === 0)
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
		this.isFolder = isFolder;
		this.folderKey = folderKey;
		this.fileKey = CryptoJS.HmacSHA256(folderKey, fileKeySalt);
		this.fileIv = fileIv;

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

		console.log(11,this.folderKey)
		this.dataBlock = SimpleEncrypt(
			(new CryptoJS.lib.WordArray.init([this.isFolder ? 0x01000000 : 0], 1)).concat(this.fileKeySalt).concat(this.fileIv).concat(Uint8ArrayToWordArray(encodedName)), 
			this.folderKey
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
		this.requestHeader.setBigUint64(16, BigInt(this.fileSize), true);
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
			throw new RangeError("File pointer values higher than Number.MAX_SAFE_INTEGER are currently unsupported");

		if(newFilePointer < 0)
			throw new Error("File pointer can't be negative");

		this.requestHeader.setBigUint64(24 /* 16 + 8 */, BigInt(this.filePointer = newFilePointer));
	}

	UploadChunk(chunkBuffer)
	{
		return new Promise(function(resolve){
			let uploadBlob = new Blob([this.requestHeader, this.encryptor.process(Uint8ArrayToWordArray(chunkBuffer))]);

			SendData("POST", "file", uploadBlob).then(function({status, response}){
				if(status !== 0)
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

		this.requestHeader.setBigUint64(24 /* 16 + 8 */, BigInt(this.fileDownloadFrom = from));
		this.requestHeader.setBigUint64(32 /* 16 + 16*/, BigInt(this.fileDownloadTo = to));
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
				if(status === 0)
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
		this.fileSizeNum = Number((new BigUint64Array(WordArrayToUint8Array(this.fileSize).buffer))[0]);
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
			let fileDownloader = new FileDownloader(this.fileId, this.fileSize, this.metadata.fileKey, this.metadata.fileIv);
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
				if(status === 0)
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

	
}

class SessionData
{
	constructor(sessionKey, innerKey, masterKey, expireTime, expireTimeNum, baseDataId, baseFolderKeySalt, currentDataId, currentFolderKeySalt)
	{
		this.sessionKey = sessionKey;
		this.innerKey = innerKey;

		this.masterKey = masterKey;
		this.expireTime = expireTime;
		this.expireTimeNum = expireTimeNum;
		this.baseDataId = baseDataId;
		this.baseFolderKeySalt = baseFolderKeySalt;
		this.currentDataId = currentDataId;
		this.currentFolderKeySalt = currentFolderKeySalt;
		this.currentFolderKey = CryptoJS.HmacSHA256(
			new CryptoJS.lib.WordArray.init([], 0).concat(this.masterKey).concat(this.currentDataId),
			this.currentFolderKeySalt
		);
	}

	static FromDataBlock(dataBlock, sessionKey, innerKey)
	{
		console.log("hello", dataBlock, sessionKey, innerKey);

		dataBlock = SimpleDecrypt(SimpleDecrypt(dataBlock, innerKey), sessionKey);

		let masterKey = SliceWordArray(dataBlock, 0, 32);
		let expireTime = SliceWordArray(dataBlock, 32, 40);
		let baseDataId = SliceWordArray(dataBlock, 40, 56);
		let baseFolderKeySalt = SliceWordArray(dataBlock, 56, 72);
		let currentDataId = SliceWordArray(dataBlock, 72, 88);
		let currentFolderKeySalt = SliceWordArray(dataBlock, 88, 104);


		return new SessionData(
			sessionKey,
			innerKey,
			masterKey,
			expireTime, 
			Number((new BigUint64Array(WordArrayToUint8Array(expireTime).buffer))[0]),
			baseDataId,
			baseFolderKeySalt,
			currentDataId,
			currentFolderKeySalt
		);
	}

	static Make(baseKey, sessionKey, expireTimeBuffer)
	{
		let masterKey = GenerateMasterKey(baseKey);
		let baseDataId = GenerateBaseDataID(baseKey);
		let baseFolderKeySalt = GenerateBaseFolderKeySalt(baseKey);

		let expireTime = Uint8ArrayToWordArray(expireTimeBuffer);
		let expireTimeNum = Number((new BigUint64Array(expireTimeBuffer.buffer))[0]);

		let innerKey = GenerateEncryptionKey();
		let outterKey = GenerateEncryptionKey();

		SetCookie("innerKey", SimpleEncrypt(innerKey, outterKey).toString(CryptoJS.enc.Base64), Date.now()/1000 - expireTime);
		localStorage.setItem("outterKey", outterKey.toString(CryptoJS.enc.Base64));

		let output = new SessionData(
			sessionKey,
			innerKey,
			masterKey,
			expireTime,
			expireTimeNum,
			baseDataId,
			baseFolderKeySalt,
			baseDataId,
			baseDataId,
			baseFolderKeySalt
		);
		output.UpdateSessionData();
		return output;
	}

	UpdateSessionData()
	{
		localStorage.setItem(
			"sessionData",
			SimpleEncrypt(
				SimpleEncrypt(
					this.ToDataBlock(),
					this.sessionKey
				),
				this.innerKey
			).toString(CryptoJS.enc.Base64)
		);
	}

	ToDataBlock()
	{
		return (new CryptoJS.lib.WordArray.init([], 0))
			.concat(this.masterKey)
			.concat(this.expireTime)
			.concat(this.baseDataId)
			.concat(this.baseFolderKeySalt)
			.concat(this.currentDataId)
			.concat(this.currentFolderKeySalt);
	}

	SetCurrentFolder(dataId, folderKeySalt)
	{
		this.currentDataId = dataId;
		this.currentFolderKeySalt = folderKeySalt;

		this.currentFolderKey = CryptoJS.HmacSHA256(
			new CryptoJS.lib.WordArray.init([], 0).concat(this.masterKey).concat(this.currentDataId),
			this.currentFolderKeySalt
		);

		this.UpdateSessionData();
	}

	SetFolderFromNetworkedFile(netFile)
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

				this.SetCurrentFolder(dataId, keySalt);
				resolve();
			});
		});
	}

	ListFiles() // 16 bytes fileId, 8 bytes fileSize, 1 byte to denote size of metadata, metadata
	{
		let _this = this;
		return new Promise(async function(resolve)
		{
			let response = await SendData("POST", "files", new Blob([WordArrayToUint8Array(_this.currentDataId)]));
			console.log("pp", response);
			if(response.status !== 0)
				throw new Error("failed to list files");

			let listBuffer = Uint8ArrayToWordArray(response.data);

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
				outputFiles.push(new NetworkedFile(_this.currentFolderKey, fileId, fileSize, FileMetadata.FromDataBlock(metadata)));
				fileObjBase += 25 + metadataLen;
			}

			return outputFiles;
		})
	}

	UploadFile(file) // MakeFile -> FileUploadRequest. Return NetworkedFile
	{
		let _this = this;
		return new Promise(async function(resolve)
		{
			console.log(_this)
			let metadata = FileMetadata.Make(file.name, false, _this.currentFolderKey);
			let fileSize = ArrayBufferToWordArray(BigUint64Array.of(BigInt(file.size)).buffer);
			let fileId = await MakeFile(_this.dataId, metadata.dataBlock, fileSize);
			let fileUploader = new FileUploader(fileId, fileSize, metadata.fileKey);

			let fileReader = file.stream().getReader();
			let fileChunk = new Uint8Array(0);//new Blob();
			fileReader.read().then(async function processChunk({done, value})
			{
				if(done)
				{
					let finalChunk;
					if(fileChunk.length !== 0)
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

export {
	ClearSession,
	LoadSession,
	Login
};