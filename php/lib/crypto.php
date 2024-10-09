<?php
	// normally i would use namespaces for this, but namespaces in php are disgusting, and neither do I want to use classes and manually add static to everything

	function GenerateKey()
	{
		return random_bytes(256/8);
	}

	function BasicEncrypt($data, $key, $options = 0)
	{
		$iv = random_bytes(128/8);
		$ciphertext = openssl_encrypt($data, "aes-256-cbc", $key, OPENSSL_RAW_DATA | $options, $iv);

		$hmac_salt = random_bytes(8);
		$cipher_hmac = hash_hmac("sha256", $ciphertext, $hmac_salt . $key, true);

		return pack("a16a8a32a*", $iv, $hmac_salt, $cipher_hmac, $ciphertext);
		//return $iv . $hmac_salt . $cipher_hmac . $ciphertext;
	}

	function BasicDecrypt($data, $key, $options = 0)
	{
		//$iv = ByteSubstring($data, 0, 16);
		//$hmac_salt = ByteSubstring($data, 16, 8);
		//$hmac = ByteSubstring($data, 24, 32);

		//$ciphertext = ByteSubstring($data, 56);

		$unpacked_data = unpack("a16iv/a8hmac_salt/a32hmac/a*ciphertext", $data);

		$computed_hmac = hash_hmac("sha256", $unpacked_data["ciphertext"], $unpacked_data["hmac_salt"] . $key, true);
		if($computed_hmac !== $unpacked_data["hmac"])
			return false;

		return openssl_decrypt($unpacked_data["ciphertext"], "aes-256-cbc", $key, OPENSSL_RAW_DATA | $options, $unpacked_data["iv"]);
	}
?>