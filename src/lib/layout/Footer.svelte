<script>
	import Twitter from '../components/svg/Twitter.svelte';

	import GitHub from '../components/svg/GitHub.svelte';
	import Instagram from '$lib/components/svg/Instagram.svelte';
	import TikTok from '$lib/components/svg/TikTok.svelte';
</script>

<footer class="footer footer-center p-10 bg-neutral text-neutral-content rounded">
	<div class="grid grid-flow-col gap-4">
		<a class="link link-hover" href="/">Home</a>
		<a class="link link-hover" href="/login">Login</a>
		<a class="link link-hover" href="/contacts">Contacts</a>
	</div>
	<div>
		<div class="grid grid-flow-col gap-4">
			<a href="https://twitter.com/avatarify_ai" target="_blank" rel="noreferrer">
				<Twitter />
			</a>
			<a href="https://github.com/epavanello/avatarify-ai.com" target="_blank" rel="noreferrer">
				<GitHub />
			</a>
			<a href="https://www.instagram.com/avatarify_ai" target="_blank" rel="noreferrer">
				<Instagram />
			</a>
			<a href="https://www.tiktok.com/@avatarify_ai" target="_blank" rel="noreferrer">
				<TikTok />
			</a>
		</div>
	</div>
	<div>
		<p>Copyright © {new Date().getFullYear()} - All right reserved</p>
	</div>
</footer>
