import {
	GetMasterKey
} from "$lib/session";

import { api_base } from "$lib/networking";



function FetchFileList()
{
	return new Promise(function(resolver){
		GetMasterKey().then(function(){
			fetch(api_base + "file", {
				method: "GET",
				credentials: "include"
			}).then(async function(response){
				let buffer = await response.arrayBuffer();
				let status = new Uint8Array(buffer, 0, 1)[0];
				
				if(status === 0) // success
				{
					let read_chunk_size = new BigUint64Array(buffer.slice(1, 9))[0];
					let file_list_json = new TextDecoder.decode(new Uint8Array(buffer, 1 + 8));

					let file_list;
					try {
						file_list = JSON.parse(file_list_json);
					}
					catch(ex) {
						file_list = null;
					}

					return resolver(read_chunk_size, file_list);
				}
			});
		})
	});
}

export {
	FetchFileList
};