// Telegram Web App SDK hook
const tg = window.Telegram?.WebApp;

export function useTelegram() {
  function ready() {
    tg?.ready();
  }

  function expand() {
    tg?.expand();
  }

  function close() {
    tg?.close();
  }

  function setMainButton(text, onClick) {
    if (!tg) return;
    tg.MainButton.setText(text);
    tg.MainButton.show();
    tg.MainButton.onClick(onClick);
  }

  function hideMainButton() {
    tg?.MainButton.hide();
  }

  function showBackButton(onClick) {
    if (!tg) return;
    tg.BackButton.show();
    tg.BackButton.onClick(onClick);
  }

  function hideBackButton() {
    tg?.BackButton.hide();
  }

  function showAlert(message) {
    if (tg) tg.showAlert(message);
    else alert(message);
  }

  function showConfirm(message, callback) {
    if (tg) tg.showConfirm(message, callback);
    else callback(window.confirm(message));
  }

  function haptic(type = 'light') {
    tg?.HapticFeedback?.impactOccurred(type);
  }

  return {
    tg,
    user: tg?.initDataUnsafe?.user,
    initData: tg?.initData || (import.meta.env.DEV ? 'dev' : ''),
    colorScheme: tg?.colorScheme || 'light',
    ready,
    expand,
    close,
    setMainButton,
    hideMainButton,
    showBackButton,
    hideBackButton,
    showAlert,
    showConfirm,
    haptic,
    isAvailable: !!tg,
  };
}
