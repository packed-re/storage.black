<?php
	require_once($_SERVER["DOCUMENT_ROOT"] . "/../lib/crypto.php");

	$_DEBUG = true;

	$_valid_origins = [
		"http://localhost:5173" => true
	];

	function get_cors_origin()
	{
		global $_valid_origins;

		$origin = $_SERVER["HTTP_ORIGIN"];
		if(isset($_valid_origins[$origin]))
			return $origin;
		
		return false;
	}

	function handle_cors()
	{
		if(GetHeader("Sec-Fetch-Mode") === "cors") // sometimes the full request is given right away
		{
			$origin = get_cors_origin();
			if($origin)
			{
				header("Access-Control-Allow-Origin: " . $origin);
				header("Access-Control-Max-Age: 7200");
				header("Access-Control-Allow-Credentials: true");
				header("Access-Control-Allow-Methods: GET, POST, DELETE");
			}
		}

		if($_SERVER["REQUEST_METHOD"] === "OPTIONS")
		{
			ob_clean(); // just incase
			exit();
		}
	}

	function handle_errors()
	{
		set_exception_handler(function($throwable){
			ExitResponse(
				ResponseType::UnknownServerError,
				CreateSecureResponseData(sprintf("Uncaught Exception\n%s: %s\n\nStack Trace:\n%s", get_class($throwable), $throwable->getMessage(), $throwable->getTraceAsString()))
			);
		});

		set_error_handler(function(
			$errno,
			$errstr,
			$errfile,
			$errline,
			$errocontext = null
		){
			ExitResponse(
				ResponseType::UnknownServerError,
				CreateSecureResponseData(sprintf("Uncaught Error (%d) - Line %d of %s\n%s", $errno, $errline, $errfile, $errstr))
			);
		});
	}

	function RouteSetup()
	{
		handle_errors();
		handle_cors();
	}

	if(function_exists("mb_strlen")) // gotta love php
	{
		function ByteStringLength($str)
		{
			return mb_strlen($str, "8bit");
		}
	}
	else
	{
		function ByteStringLength($str)
		{
			return strlen($str);
		}
	}

	if(function_exists("mb_substr")) // gotta love php
	{
		function ByteSubString(&$str, $start, $length = null)
		{
			return mb_substr($str, $start, $length, "8bit");
		}
	}
	else
	{
		function ByteSubString(&$str, $start, $length = null)
		{
			return substr($str, $start, $length);
		}
	}
	
	function MYSQLMakeString($mysqli, $str) // got tired of adding escaped quotes
	{
		return "\"" . $mysqli->real_escape_string($str) . "\"";
	}

	enum ResponseType: int
	{
		case Success = 0;
		case MissingArgument = 1;
		case BadArgument = 2;
		case BadRequest = 3;
		case BadRequestMethod = 4;
		case SessionExpired = 5;
		case FileAllocationFailed = 6;
		case ServerError = 7;
		case UnknownServerError = 8;
	}

	$___response_encryption_key = hex2bin("98b32fc776e8497d26f594d02eed92746eb1adc8f77fb6ca1cf8674e38bf6a77");

	function CreateSecureResponseData($data) // for data we want to return to the client without letting it know its raw contents
	{
		global $_DEBUG;
		global $___response_encryption_key;

		if($_DEBUG === true)
			return $data;
		else
			return BasicEncrypt($data, $___response_encryption_key);
	}

	function CreateResponse($responseType, $data=null, $secure_response_data = false) // data is expected to be a string
	{
		return pack("Ca*", $responseType->value, $secure_response_data ? CreateSecureResponseData($data) : $data);
	}

	function ExitResponse($responseType, $data = null, $secure_response_data = false)
	{
		ob_clean();
		exit(CreateResponse($responseType, $data, $secure_response_data));
	}

	function GetHeader($name)
	{
		$headerName = str_replace("-", "_", strtoupper($name));
		if(isset($_SERVER["HTTP_".$headerName]))
		{
			return $_SERVER["HTTP_".$headerName];
		}
		else
		{
			return getallheaders()[implode("-", array_map(function($v)
			{
				$v[0] = strtoupper($v[0]);
				return $v;
			},
			explode("-", strtolower($name))))] ?? null;
		}
	}

	function RemoveCookie($name)
	{
		setcookie($name, "", 0);
	}

	function GetAllRequestData()
	{
		$out = file_get_contents("php://input");

		$decodedJson = json_decode($out, true);
		if($decodedJson === null)
			mb_parse_str($out, $out);
		else
			$out = $decodedJson;

		foreach($_GET as $key => $value)
		{
			$out[$key] = $value;
		}

		return $out;
	}
?>