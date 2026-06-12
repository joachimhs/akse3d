<script>
  import '$lib/akse-theme.css';

  let { children } = $props();
</script>

<svelte:head>
  <link
    rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
  />
  <!-- Standalone-font (matcher --akse-font i akse-theme.css). Host bruker egen font. -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&display=swap"
  />
</svelte:head>

{@render children?.()}
