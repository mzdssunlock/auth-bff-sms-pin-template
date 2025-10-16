<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { logout } from "./auth/data.remote";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  let user = $derived(data.user);
  let error = $derived(data.error);
  let loading = $state(false);

  async function handleLogout() {
    loading = true;
    try {
      await logout();
      window.location.href = "/";
    } catch (err) {
      console.error("Logout error:", err);
      loading = false;
    }
  }
</script>

<svelte:head>
  <title>SMS + PIN Авторизация</title>
</svelte:head>

<main>
  <h1>🔐 SMS + PIN Авторизация</h1>

  {#if error}
    <div class="error-message">
      <h2>Ошибка авторизации</h2>
      <p>
        {#if error === "invalid_request"}
          Неверный запрос авторизации
        {:else if error === "invalid_state"}
          Неверный параметр state
        {:else if error === "auth_failed"}
          Ошибка при авторизации
        {:else}
          Произошла неизвестная ошибка
        {/if}
      </p>
    </div>
  {/if}

  {#if user}
    <div class="user-info">
      <h2>✅ Вы авторизованы</h2>
      <div class="user-details">
        <p><strong>Телефон:</strong> {user.phone || "не указан"}</p>
        <p><strong>User ID:</strong> {user.userId}</p>
      </div>

      <div class="actions">
        <a href="/profile" class="btn btn-primary">Мой профиль</a>
        <button
          onclick={handleLogout}
          disabled={loading}
          class="btn btn-secondary"
        >
          {loading ? "Выход..." : "Выйти"}
        </button>
      </div>
    </div>
  {:else}
    <div class="auth-prompt">
      <h2>Для доступа к приложению необходимо авторизоваться</h2>
      <p>Используйте SMS код или PIN для быстрого входа</p>
      <a href="/auth/sms-login" class="btn btn-primary">Войти</a>
    </div>
  {/if}

  <div class="info-block">
    <h3>О проекте</h3>
    <p>
      Это демо SMS + PIN авторизации на SvelteKit 5 с Backend-for-Frontend
      паттерном.
    </p>
    <ul>
      <li>✅ SMS коды для первичной авторизации</li>
      <li>✅ PIN коды для быстрого входа</li>
      <li>✅ HTTP-only cookies (безопасность)</li>
      <li>✅ Rate limiting (защита от брутфорса)</li>
      <li>✅ PostgreSQL + Drizzle ORM для хранения данных</li>
      <li>✅ Argon2 для хеширования PIN</li>
    </ul>
  </div>
</main>

<style>
  main {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    text-align: center;
  }

  h1 {
    font-size: 2.5rem;
    margin-bottom: 2rem;
    color: #1a202c;
  }

  .error-message {
    background: #fed7d7;
    padding: 2rem;
    border-radius: 12px;
    margin: 2rem 0;
    color: #c53030;
    box-shadow: 0 4px 12px rgba(229, 62, 62, 0.15);
  }

  .user-info {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 2rem;
    border-radius: 12px;
    margin: 2rem 0;
    box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
  }

  .user-details {
    background: rgba(255, 255, 255, 0.2);
    padding: 1.5rem;
    border-radius: 8px;
    margin: 1.5rem 0;
  }

  .user-details p {
    margin: 0.5rem 0;
    font-size: 1rem;
  }

  .actions {
    display: flex;
    gap: 1rem;
    justify-content: center;
    margin-top: 1.5rem;
  }

  .auth-prompt {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    color: white;
    padding: 2rem;
    border-radius: 12px;
    margin: 2rem 0;
    box-shadow: 0 10px 30px rgba(245, 87, 108, 0.3);
  }

  .btn {
    display: inline-block;
    padding: 0.875rem 1.5rem;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    transition: all 0.2s;
    border: none;
    cursor: pointer;
    font-size: 1rem;
  }

  .btn-primary {
    background: white;
    color: #667eea;
  }

  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(255, 255, 255, 0.3);
  }

  .btn-secondary {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: 2px solid white;
  }

  .btn-secondary:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.3);
  }

  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .info-block {
    background: #f7fafc;
    padding: 2rem;
    border-radius: 12px;
    margin-top: 3rem;
    text-align: left;
  }

  .info-block h3 {
    margin-top: 0;
    color: #2d3748;
  }

  .info-block ul {
    list-style: none;
    padding: 0;
  }

  .info-block li {
    margin: 0.75rem 0;
    padding-left: 1.5rem;
    position: relative;
  }

  .info-block li::before {
    content: "✓";
    position: absolute;
    left: 0;
    color: #48bb78;
    font-weight: bold;
  }
</style>
