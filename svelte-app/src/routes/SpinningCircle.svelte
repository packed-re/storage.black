
<script>
	export let size;
	export let speed = "1s";
</script>

<style>
	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.spinning-circle{
		border-top: 2px solid rgb(100, 100, 100);
		border-radius: 50%;
		animation: spin linear infinite;
	}
</style>

<div class="spinning-circle" style="width: {size}; height: {size}; animation-duration: {speed}"></div>