<script lang="ts">
  import { goto } from "$app/navigation";
  import {
    requestOTP,
    verifyOTP,
    setupPIN,
    loginWithPIN,
  } from "../data.remote";

  // Reactive state
  let phone = $state("");
  let otpCode = $state("");
  let pin = $state("");
  let confirmPin = $state("");
  let step = $state<"phone" | "otp" | "pin-login" | "setup-pin">("phone");
  let error = $state("");
  let loading = $state(false);
  let attemptsLeft = $state<number | undefined>(undefined);

  // Derived состояния
  let isPhoneValid = $derived(
    /^\+7\d{10}$/.test(phone) ||
      /^7\d{10}$/.test(phone) ||
      /^\d{10}$/.test(phone),
  );
  let isOTPValid = $derived(/^\d{6}$/.test(otpCode));
  let isPINValid = $derived(/^\d{4,6}$/.test(pin));
  let pinsMatch = $derived(pin === confirmPin && pin.length >= 4);

  // Форматирование телефона
  function formatPhone(value: string): string {
    // Убираем все нецифровые символы
    const digits = value.replace(/\D/g, "");

    // Автоматически добавляем +7
    if (digits.length === 0) return "";
    if (digits.startsWith("8")) return "+7" + digits.slice(1);
    if (digits.startsWith("7")) return "+" + digits;
    return "+7" + digits;
  }

  // Шаг 1: Запрос OTP
  async function handleRequestOTP(e: Event) {
    e.preventDefault();
    loading = true;
    error = "";
    attemptsLeft = undefined;

    try {
      const formattedPhone = formatPhone(phone);
      await requestOTP({ phone: formattedPhone });
      phone = formattedPhone;
      step = "otp";
    } catch (err) {
      error = err instanceof Error ? err.message : "Ошибка отправки кода";
    } finally {
      loading = false;
    }
  }

  // Шаг 2: Проверка OTP
  async function handleVerifyOTP(e: Event) {
    e.preventDefault();
    loading = true;
    error = "";

    try {
      const result = (await verifyOTP({
        phone,
        code: otpCode,
      })) as { requiresPinSetup?: boolean };

      if (result.requiresPinSetup) {
        step = "setup-pin";
      } else {
        await goto("/");
      }
    } catch (err: unknown) {
      const errData = err as { attemptsLeft?: number };
      if (errData.attemptsLeft !== undefined) {
        attemptsLeft = errData.attemptsLeft;
      }
      error = err instanceof Error ? err.message : "Ошибка проверки кода";
    } finally {
      loading = false;
    }
  }

  // Шаг 3: Установка PIN
  async function handleSetupPIN(e: Event) {
    e.preventDefault();

    if (!pinsMatch) {
      error = "PIN коды не совпадают";
      return;
    }

    loading = true;
    error = "";

    try {
      await setupPIN({ pin });
      await goto("/");
    } catch (err) {
      error = err instanceof Error ? err.message : "Ошибка установки PIN";
    } finally {
      loading = false;
    }
  }

  // Альтернативный вход по PIN
  async function handleLoginWithPIN(e: Event) {
    e.preventDefault();
    loading = true;
    error = "";

    try {
      const formattedPhone = formatPhone(phone);
      await loginWithPIN({ phone: formattedPhone, pin });
      await goto("/");
    } catch (err) {
      error = err instanceof Error ? err.message : "Ошибка входа";
    } finally {
      loading = false;
    }
  }

  // Переключение шагов
  function goToPhoneStep() {
    step = "phone";
    error = "";
    otpCode = "";
    attemptsLeft = undefined;
  }

  function goToPINLogin() {
    step = "pin-login";
    error = "";
    pin = "";
  }
</script>

<div class="auth-container">
  <div class="auth-card">
    {#if step === "phone"}
      <h1>Вход</h1>
      <p class="subtitle">Введите номер телефона</p>

      <form onsubmit={handleRequestOTP}>
        <div class="input-group">
          <label for="phone">Номер телефона</label>
          <input
            id="phone"
            type="tel"
            bind:value={phone}
            placeholder="+7 999 123 45 67"
            required
            autocomplete="tel"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !isPhoneValid}
          class="btn-primary"
        >
          {loading ? "Отправка..." : "Получить код"}
        </button>
      </form>

      <button type="button" class="btn-link" onclick={goToPINLogin}>
        Войти по PIN коду
      </button>
    {:else if step === "otp"}
      <h1>Введите код из SMS</h1>
      <p class="subtitle">Код отправлен на {phone}</p>

      <form onsubmit={handleVerifyOTP}>
        <div class="input-group">
          <label for="otp">Код из SMS</label>
          <input
            id="otp"
            type="text"
            bind:value={otpCode}
            placeholder="123456"
            required
            inputmode="numeric"
            maxlength="6"
            autocomplete="one-time-code"
          />
          {#if attemptsLeft !== undefined}
            <p class="hint">Осталось попыток: {attemptsLeft}</p>
          {/if}
        </div>

        <button
          type="submit"
          disabled={loading || !isOTPValid}
          class="btn-primary"
        >
          {loading ? "Проверка..." : "Подтвердить"}
        </button>
      </form>

      <button type="button" class="btn-link" onclick={goToPhoneStep}>
        Запросить новый код
      </button>
    {:else if step === "setup-pin"}
      <h1>Установите PIN код</h1>
      <p class="subtitle">Для быстрого входа в следующий раз</p>

      <form onsubmit={handleSetupPIN}>
        <div class="input-group">
          <label for="pin">PIN код (4-6 цифр)</label>
          <input
            id="pin"
            type="password"
            bind:value={pin}
            placeholder="••••"
            required
            inputmode="numeric"
            maxlength="6"
            autocomplete="new-password"
          />
        </div>

        <div class="input-group">
          <label for="confirm-pin">Повторите PIN</label>
          <input
            id="confirm-pin"
            type="password"
            bind:value={confirmPin}
            placeholder="••••"
            required
            inputmode="numeric"
            maxlength="6"
            autocomplete="new-password"
          />
          {#if pin && confirmPin && !pinsMatch}
            <p class="hint error-hint">PIN коды не совпадают</p>
          {/if}
        </div>

        <button
          type="submit"
          disabled={loading || !pinsMatch}
          class="btn-primary"
        >
          {loading ? "Сохранение..." : "Установить PIN"}
        </button>
      </form>

      <button
        type="button"
        class="btn-link"
        onclick={() => {
          goto("/");
        }}
      >
        Пропустить
      </button>
    {:else if step === "pin-login"}
      <h1>Вход по PIN</h1>
      <p class="subtitle">Быстрый вход для зарегистрированных</p>

      <form onsubmit={handleLoginWithPIN}>
        <div class="input-group">
          <label for="phone-pin">Номер телефона</label>
          <input
            id="phone-pin"
            type="tel"
            bind:value={phone}
            placeholder="+7 999 123 45 67"
            required
            autocomplete="tel"
          />
        </div>

        <div class="input-group">
          <label for="pin-login">PIN код</label>
          <input
            id="pin-login"
            type="password"
            bind:value={pin}
            placeholder="••••"
            required
            inputmode="numeric"
            maxlength="6"
            autocomplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !isPhoneValid || !isPINValid}
          class="btn-primary"
        >
          {loading ? "Вход..." : "Войти"}
        </button>
      </form>

      <button type="button" class="btn-link" onclick={goToPhoneStep}>
        Войти по SMS коду
      </button>
    {/if}

    {#if error}
      <p class="error">{error}</p>
    {/if}
  </div>
</div>

<style>
  .auth-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    padding: 1rem;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .auth-card {
    background: white;
    border-radius: 1rem;
    padding: 2rem;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    width: 100%;
    max-width: 400px;
  }

  h1 {
    margin: 0 0 0.5rem 0;
    font-size: 1.75rem;
    font-weight: 700;
    color: #1a202c;
  }

  .subtitle {
    margin: 0 0 2rem 0;
    color: #718096;
    font-size: 0.95rem;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    margin-bottom: 1rem;
  }

  .input-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #4a5568;
  }

  input {
    padding: 0.75rem 1rem;
    border: 2px solid #e2e8f0;
    border-radius: 0.5rem;
    font-size: 1rem;
    transition: all 0.2s;
  }

  input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  .hint {
    font-size: 0.875rem;
    color: #718096;
    margin: 0;
  }

  .error-hint {
    color: #e53e3e;
  }

  .btn-primary {
    padding: 0.875rem 1.5rem;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary:hover:not(:disabled) {
    background: #5568d3;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  .btn-primary:disabled {
    background: #cbd5e0;
    cursor: not-allowed;
  }

  .btn-link {
    background: none;
    border: none;
    color: #667eea;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    padding: 0.5rem;
    margin-top: 0.5rem;
    transition: color 0.2s;
  }

  .btn-link:hover {
    color: #5568d3;
    text-decoration: underline;
  }

  .error {
    margin: 1rem 0 0 0;
    padding: 0.75rem 1rem;
    background: #fed7d7;
    color: #c53030;
    border-radius: 0.5rem;
    font-size: 0.9rem;
  }
</style>
