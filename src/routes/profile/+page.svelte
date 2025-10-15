<script lang="ts">
  import { logout } from "../auth/data.remote";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

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

  // Форматирование даты
  function formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
</script>

<svelte:head>
  <title>Мой профиль</title>
</svelte:head>

<main>
  <div class="profile-container">
    <div class="profile-header">
      <h1>👤 Мой профиль</h1>
      <a href="/" class="back-link">← Назад</a>
    </div>

    <div class="profile-card">
      <div class="info-section">
        <h2>Информация о пользователе</h2>

        <div class="info-row">
          <span class="label">Телефон</span>
          <span class="value">{data.user.phone}</span>
        </div>

        <div class="info-row">
          <span class="label">User ID</span>
          <span class="value mono">{data.user.userId}</span>
        </div>

        <div class="info-row">
          <span class="label">PIN код</span>
          <span class="value">
            {#if data.user.hasPIN}
              <span class="badge success">Установлен</span>
            {:else}
              <span class="badge warning">Не установлен</span>
            {/if}
          </span>
        </div>

        <div class="info-row">
          <span class="label">Дата регистрации</span>
          <span class="value">{formatDate(data.user.createdAt)}</span>
        </div>

        <div class="info-row">
          <span class="label">Последний вход</span>
          <span class="value">{formatDate(data.user.lastLoginAt)}</span>
        </div>
      </div>

      <div class="actions-section">
        <button
          onclick={handleLogout}
          disabled={loading}
          class="btn btn-logout"
        >
          {loading ? "Выход..." : "Выйти из аккаунта"}
        </button>
      </div>
    </div>

    <div class="security-info">
      <h3>🔒 Безопасность</h3>
      <p>
        Ваша сессия защищена HTTP-only cookies и автоматически истекает через 24
        часа.
      </p>
      <p>
        {#if data.user.hasPIN}
          Вы можете использовать PIN код для быстрого входа.
        {:else}
          Установите PIN код при следующем входе для более быстрой авторизации.
        {/if}
      </p>
    </div>
  </div>
</main>

<style>
  main {
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 2rem;
  }

  .profile-container {
    max-width: 700px;
    margin: 0 auto;
  }

  .profile-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  h1 {
    color: white;
    margin: 0;
    font-size: 2rem;
  }

  .back-link {
    color: white;
    text-decoration: none;
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    transition: all 0.2s;
  }

  .back-link:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .profile-card {
    background: white;
    border-radius: 16px;
    padding: 2rem;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    margin-bottom: 1.5rem;
  }

  .info-section h2 {
    margin-top: 0;
    margin-bottom: 1.5rem;
    color: #2d3748;
    font-size: 1.5rem;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 0;
    border-bottom: 1px solid #e2e8f0;
  }

  .info-row:last-child {
    border-bottom: none;
  }

  .label {
    font-weight: 600;
    color: #4a5568;
  }

  .value {
    color: #2d3748;
    font-weight: 500;
  }

  .mono {
    font-family: "Courier New", monospace;
    font-size: 0.9rem;
  }

  .badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .badge.success {
    background: #c6f6d5;
    color: #22543d;
  }

  .badge.warning {
    background: #fef5e7;
    color: #744210;
  }

  .actions-section {
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 2px solid #e2e8f0;
    text-align: center;
  }

  .btn {
    padding: 0.875rem 2rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-logout {
    background: #fc8181;
    color: white;
  }

  .btn-logout:hover:not(:disabled) {
    background: #f56565;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(245, 101, 101, 0.4);
  }

  .btn-logout:disabled {
    background: #cbd5e0;
    cursor: not-allowed;
  }

  .security-info {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  }

  .security-info h3 {
    margin-top: 0;
    color: #2d3748;
  }

  .security-info p {
    color: #4a5568;
    margin: 0.75rem 0;
    line-height: 1.6;
  }
</style>
