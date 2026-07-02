let _state = null;

export function setLoggerState(state) {
  _state = state;
}

export function createLogger(prefix) {
  return function log(msg, accountId) {
    const tag = accountId ? `[${accountId}]` : '';
    const fullMsg = `${prefix} ${tag} ${msg}`;
    console.log(fullMsg);
    if (_state?.logs) {
      _state.logs.push({
        time: new Date().toISOString(),
        level: 'info',
        message: fullMsg,
      });
      if (_state.logs.length > 1000) _state.logs.splice(0, _state.logs.length - 1000);
    }
  };
}

export function pushLog(message, level = 'info') {
  if (_state?.logs) {
    _state.logs.push({ time: new Date().toISOString(), level, message });
    if (_state.logs.length > 1000) _state.logs.splice(0, _state.logs.length - 1000);
  }
}
