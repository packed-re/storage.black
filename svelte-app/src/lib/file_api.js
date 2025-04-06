import {
	WordArrayToUint8Array,
	DataViewWriteUint8Array
} from "$lib";

const API_BASE = "http://localhost/api/v1/"; 

const MAKE_FILE_HEADER_MIN_SIZE = 128 + 8; // dataId + fileSize | + metadata
const FILE_UPLOAD_HEADER_SIZE = 128 + 8 + 8; // fileId + fileSize + filePointer
const FILE_DOWNLOAD_HEADER_SIZE = 128 + 8 + 8 + 8; // fileId + fileSize + rangeStart + rangeEnd
const FILE_TRANSFER_CHUNK_SIZE = 1_000_000; // 1 MB

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

	Send()
	{
		
	}
}

class FileDownloadRequest extends FileTransferRequestBase
{
	constructor(fileId, fileSize, encryptionKey)
	{
		super(new DataView(new ArrayBuffer(FILE_DOWNLOAD_HEADER_SIZE)), fileId, fileSize, encryptionKey);

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

	Send()
	{
		
	}
}


class NetworkedFile
{
	Download() // return blob
	{

	}

	Rename() // void, throw on failure
	{

	}

	Delete() // void, throw on failure
	{

	}
}

class FolderState
{
	ListFiles()
	{
	
	}

	UploadFile(file) // MakeFileRequest -> FileUploadRequest. Return NetworkedFile
	{
	
	}
}