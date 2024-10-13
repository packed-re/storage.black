<?php
	require_once($_SERVER["DOCUMENT_ROOT"] . "/lib/crypto.php");

	$_valid_origins = [
		"http://localhost:5173" => true // value can be whatever
	];

	function get_cors_origin()
	{
		global $_valid_origins;

		$origin = $_SERVER["HTTP_ORIGIN"];		
		if(isset($_valid_origins[$origin]))
			return $origin;
		
		return false;

		if(isset($_valid_origins[$origin]))
			header("Access-Control-Allow-Origin: " . $origin);
	}

	function handle_cors()
	{
		if(GetHeader("Sec-Fetch-Mode") === "cors") // sometimes the full request is given right away
		{
			$origin = get_cors_origin();
			if($origin)
			{
				header("Access-Control-Allow-Origin: " . $origin);
				header("Access-Control-Max-Age: 7200"); // test not using this
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
				sprintf("Uncaught Exception\n%s: %s\n\nStack Trace:\n%s", get_class($throwable), $throwable->getMessage(), $throwable->getTraceAsString())
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
				sprintf("Uncaught Error (%d) - Line %d of %s\n%s", $errno, $errline, $errfile, $errstr)
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
	
	enum ResponseType: int
	{
		case Success = 0;
		case MissingArgument = 1;
		case BadArgument = 2;
		case SessionExpired = 3;
		case BadRequestMethod = 4;
		case ServerError = 5;
		case UnknownServerError = 6;
	}

	function CreateResponse($responseType, $data=null) // data is expected to be a string
	{
		return pack("Ca*", $responseType->value, $data);
	}

	function ExitResponse($responseType, $data = null)
	{
		ob_clean();
		exit(CreateResponse($responseType, $data));
	}

	$___response_encryption_key = hex2bin("98b32fc776e8497d26f594d02eed92746eb1adc8f77fb6ca1cf8674e38bf6a77");

	function CreateSecureResponseData($data) // for data we want to return to the client without letting it know its contents
	{
		global $___response_encryption_key;

		return BasicEncrypt($data, $___response_encryption_key);
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