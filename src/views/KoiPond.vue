<script>
  import { koiPond } from '@/assets/javascript/koiPond/koiPond'

  export default {
    setup() {
      return {
        currentId: '',
        appLaunched: true,
        show: true
      }
    },
    mounted() {
      koiPond();
    },
  }
</script>

<template>
  <div>
    <div id="koiPond" />
    <div class="text-window green width">
      <p>
        Welcome to my portfolio page! It is currently under construction,
        so please enjoy this koi pond created with Three.js, TypeScript,
        and Vue 3. There's a lot packed into this little scene,
        so feel free to explore using your mouse or touchpad.
      </p>
    </div>
    <div class="text-window-backing width"/>

    <div class="quick-links">
      <a href="https://www.linkedin.com/in/seth-brady-1b689096/">
        <img src="@assets/linkedin.svg" />
      </a>
    </div>
  </div>
</template>

<style scoped>

  .width {
    width: 300px;
  }

  @media all and (max-width: 479px) {
    .width {
      width: 80vw;
    }
  }

  .text-window {
    left: 24px;
    position: fixed !important;
    top: 10px;
    z-index:1;
  }
  .text-window-backing {
    background-color: #222233b8;
    border-radius: 2px;
    left: 20px;
    position: fixed !important;
    top: 20px;
    height: 150px;
    z-index:0;
  }

  p {
    font-size: .9rem;
    margin-top: 1rem;
    padding: 0;
    position: relative;
  }

  .quick-links {
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    display: flex;
    justify-content: flex-start;
  }

  a {
    width: 40px;
    height: 20px;
    margin-top: 1rem;
    position: relative;
    bottom: 40px;
    left: 20px;
  }

  a:hover {
    cursor: pointer;
    scale: 1.25;
    background-color: #222233;
  }

  img {
    width: 40px;
    height: 40px;
  }


</style>
