import React from 'react';

/**
 * Общая раскладка для экранов игр:
 * - top: верхняя зона (статус/таймер/стрелка, если нужно)
 * - center: основной контент
 * - bottom: нижняя панель действий
 */
export default function GameLayout({
  top,
  children,
  bottom,
  padding = 24,
  textAlign = 'center',
  minHeight = '100vh',
  center = true,
}) {
  return (
    <div
      style={{
        padding,
        textAlign,
        minHeight,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        position: 'relative',
      }}
    >
      {top || null}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: center ? 'center' : 'flex-start' }}>{children}</div>
      {bottom ? <div style={{ marginTop: 'auto' }}>{bottom}</div> : null}
    </div>
  );
}

