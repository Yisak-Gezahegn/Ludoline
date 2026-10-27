/**
 * TelegramVerification.test.js
 * Frontend tests for the Telegram verification hook and component.
 * Uses React Testing Library + Jest.
 *
 * Install: npm install --save-dev @testing-library/react @testing-library/user-event @testing-library/jest-dom jest-environment-jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Mock API client
jest.mock('../api/client', () => ({
  telegramAuthAPI: {
    startSession:     jest.fn(),
    getSessionStatus: jest.fn(),
    verifyOtp:        jest.fn(),
    resendOtp:        jest.fn(),
    cancel:           jest.fn()
  }
}));

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key, vars) => {
      const map = {
        tgVerifyTitle:       'Verify with Telegram',
        tgVerifySubtitle:    'Codes delivered via Telegram',
        tgVerifyWithTelegram:'Verify with Telegram',
        tgSessionCreating:   'Preparing link…',
        tgOpenBot:           'Open @LudolineVerifyBot',
        tgOpenBotHint:       'Tap the button, then press Start.',
        tgWaiting:           'Waiting for you to open the bot…',
        tgLinked:            'Telegram connected! Enter code.',
        tgEnterCode:         'Enter 6-digit code',
        tgVerifyCode:        'Verify Code',
        tgResendCode:        'Resend Code',
        tgResendIn:          `Resend in ${vars?.seconds}s`,
        tgCancel:            'Cancel & Restart',
        tgOtpInvalid:        'Incorrect code.',
        tgOtpExpired:        'Code expired.',
        tgSessionExpired:    'Session expired.',
        tgMaxAttempts:       'Too many attempts.',
        tgNotLinked:         'Open the bot first.',
        tgVerifySuccess:     'Verified!',
        tgStep1:             '1. Open the bot',
        tgStep2:             '2. Press Start',
        tgStep3:             '3. Enter the code here',
        tgCodeValidFor:      `Valid for ${vars?.seconds}s`,
        verifyOtp:           'Verify OTP',
        tgOrUseSms:          'Use SMS instead',
      };
      return map[key] || key;
    }
  })
}));

import { telegramAuthAPI } from '../api/client';
import TelegramVerificationPanel from '../components/auth/TelegramVerificationPanel';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function renderPanel({ phone = '+251912345678', language = 'en', onSuccess = jest.fn(), onSwitchToSms = jest.fn() } = {}) {
  return render(
    <TelegramVerificationPanel
      phone={phone}
      language={language}
      onSuccess={onSuccess}
      onSwitchToSms={onSwitchToSms}
    />
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TelegramVerificationPanel — idle state', () => {
  test('renders Verify with Telegram button', () => {
    renderPanel();
    expect(screen.getByText(/Verify with Telegram/i)).toBeInTheDocument();
  });

  test('shows subtitle', () => {
    renderPanel();
    expect(screen.getByText(/Codes delivered via Telegram/i)).toBeInTheDocument();
  });

  test('"Use SMS instead" button calls onSwitchToSms', () => {
    const onSwitchToSms = jest.fn();
    renderPanel({ onSwitchToSms });
    fireEvent.click(screen.getByText(/Use SMS instead/i));
    expect(onSwitchToSms).toHaveBeenCalled();
  });
});

describe('TelegramVerificationPanel — session creation', () => {
  beforeEach(() => jest.clearAllMocks());

  test('calls startSession and shows awaiting_link state', async () => {
    telegramAuthAPI.startSession.mockResolvedValue({
      data: {
        sessionId:        'sess-1234',
        deepLink:         'https://t.me/LudolineVerifyBot?start=abc',
        botName:          'LudolineVerifyBot',
        expiresAt:        new Date(Date.now() + 600000).toISOString(),
        expiresInSeconds: 600
      }
    });
    telegramAuthAPI.getSessionStatus.mockResolvedValue({ data: { status: 'pending' } });

    renderPanel();
    await act(async () => {
      fireEvent.click(screen.getByText(/Verify with Telegram/i));
    });

    await waitFor(() => {
      expect(screen.getByText(/Open @LudolineVerifyBot/i)).toBeInTheDocument();
    });

    expect(telegramAuthAPI.startSession).toHaveBeenCalledWith('+251912345678', 'en');
  });

  test('shows error when startSession fails', async () => {
    telegramAuthAPI.startSession.mockRejectedValue({
      response: { data: { error: 'RATE_LIMITED', message: 'Too many attempts.' } }
    });

    renderPanel();
    await act(async () => {
      fireEvent.click(screen.getByText(/Verify with Telegram/i));
    });

    await waitFor(() => {
      expect(screen.getByText(/Too many attempts/i)).toBeInTheDocument();
    });
  });
});

describe('TelegramVerificationPanel — polling transitions to awaiting_otp', () => {
  beforeEach(() => jest.clearAllMocks());

  test('transitions to OTP entry when session becomes linked', async () => {
    telegramAuthAPI.startSession.mockResolvedValue({
      data: {
        sessionId: 'sess-1234', deepLink: 'https://t.me/LudolineVerifyBot?start=abc',
        botName: 'LudolineVerifyBot', expiresAt: new Date(Date.now() + 600000).toISOString(), expiresInSeconds: 600
      }
    });

    // First poll: pending; second poll: linked
    telegramAuthAPI.getSessionStatus
      .mockResolvedValueOnce({ data: { status: 'pending' } })
      .mockResolvedValue({ data: { status: 'linked', otpAttemptsRemaining: 5, expiresAt: new Date(Date.now() + 300000).toISOString() } });

    jest.useFakeTimers();
    renderPanel();

    await act(async () => {
      fireEvent.click(screen.getByText(/Verify with Telegram/i));
    });

    // Advance timers to trigger polling
    await act(async () => { jest.advanceTimersByTime(3100); });

    await waitFor(() => {
      expect(screen.getByText(/Telegram connected/i)).toBeInTheDocument();
    });

    jest.useRealTimers();
  });
});

describe('TelegramVerificationPanel — OTP submission', () => {
  beforeEach(() => jest.clearAllMocks());

  async function setupLinkedState() {
    telegramAuthAPI.startSession.mockResolvedValue({
      data: {
        sessionId: 'sess-1234', deepLink: 'https://t.me/LudolineVerifyBot?start=abc',
        botName: 'LudolineVerifyBot', expiresAt: new Date(Date.now() + 600000).toISOString(), expiresInSeconds: 600
      }
    });
    telegramAuthAPI.getSessionStatus.mockResolvedValue({
      data: { status: 'linked', otpAttemptsRemaining: 5, expiresAt: new Date(Date.now() + 300000).toISOString() }
    });

    jest.useFakeTimers();
    const utils = renderPanel();
    await act(async () => { fireEvent.click(screen.getByText(/Verify with Telegram/i)); });
    await act(async () => { jest.advanceTimersByTime(3100); });
    await waitFor(() => expect(screen.getByLabelText(/six digit verification code/i)).toBeInTheDocument());
    jest.useRealTimers();
    return utils;
  }

  test('Submit button disabled for incomplete OTP', async () => {
    await setupLinkedState();
    const btn = screen.getByRole('button', { name: /Submit verification code/i });
    expect(btn).toBeDisabled();
  });

  test('Submit button enabled with 6 digits', async () => {
    await setupLinkedState();
    const input = screen.getByLabelText(/six digit verification code/i);
    await userEvent.type(input, '123456');
    const btn = screen.getByRole('button', { name: /Submit verification code/i });
    expect(btn).not.toBeDisabled();
  });

  test('calls verifyOtp and triggers onSuccess', async () => {
    const onSuccess = jest.fn();
    telegramAuthAPI.startSession.mockResolvedValue({
      data: { sessionId: 'sess-1234', deepLink: 'https://t.me/bot?start=x', botName: 'Bot', expiresAt: new Date(Date.now() + 600000).toISOString(), expiresInSeconds: 600 }
    });
    telegramAuthAPI.getSessionStatus.mockResolvedValue({
      data: { status: 'linked', otpAttemptsRemaining: 5, expiresAt: new Date(Date.now() + 300000).toISOString() }
    });
    telegramAuthAPI.verifyOtp.mockResolvedValue({
      data: { token: 'jwt-token', user: { id: '1', phone: '+251912345678', profileComplete: false }, isNew: true }
    });

    jest.useFakeTimers();
    render(<TelegramVerificationPanel phone="+251912345678" language="en" onSuccess={onSuccess} />);
    await act(async () => { fireEvent.click(screen.getByText(/Verify with Telegram/i)); });
    await act(async () => { jest.advanceTimersByTime(3100); });
    jest.useRealTimers();

    await waitFor(() => expect(screen.getByLabelText(/six digit verification code/i)).toBeInTheDocument());

    const input = screen.getByLabelText(/six digit verification code/i);
    await userEvent.type(input, '654321');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Submit verification code/i }));
    });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ token: 'jwt-token' })));
  });

  test('shows OTP_INVALID error and stays on OTP entry', async () => {
    telegramAuthAPI.startSession.mockResolvedValue({
      data: { sessionId: 'sess-1234', deepLink: 'https://t.me/bot?start=x', botName: 'Bot', expiresAt: new Date(Date.now() + 600000).toISOString(), expiresInSeconds: 600 }
    });
    telegramAuthAPI.getSessionStatus.mockResolvedValue({
      data: { status: 'linked', otpAttemptsRemaining: 5, expiresAt: new Date(Date.now() + 300000).toISOString() }
    });
    telegramAuthAPI.verifyOtp.mockRejectedValue({
      response: { data: { error: 'OTP_INVALID', message: 'Incorrect code.' } }
    });

    jest.useFakeTimers();
    renderPanel();
    await act(async () => { fireEvent.click(screen.getByText(/Verify with Telegram/i)); });
    await act(async () => { jest.advanceTimersByTime(3100); });
    jest.useRealTimers();

    await waitFor(() => expect(screen.getByLabelText(/six digit verification code/i)).toBeInTheDocument());
    const input = screen.getByLabelText(/six digit verification code/i);
    await userEvent.type(input, '000000');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Submit verification code/i })); });

    await waitFor(() => expect(screen.getByText(/Incorrect code/i)).toBeInTheDocument());
    // Should still show OTP input
    expect(screen.getByLabelText(/six digit verification code/i)).toBeInTheDocument();
  });

  test('supports pasting 6-digit code', async () => {
    await setupLinkedState();
    const input = screen.getByLabelText(/six digit verification code/i);
    fireEvent.paste(input, { clipboardData: { getData: () => '  987654  ' } });
    expect(input.value).toBe('987654');
  });

  test('supports keyboard Enter to submit', async () => {
    const onSuccess = jest.fn();
    telegramAuthAPI.startSession.mockResolvedValue({
      data: { sessionId: 'sess-1234', deepLink: 'https://t.me/bot?start=x', botName: 'Bot', expiresAt: new Date(Date.now() + 600000).toISOString(), expiresInSeconds: 600 }
    });
    telegramAuthAPI.getSessionStatus.mockResolvedValue({
      data: { status: 'linked', otpAttemptsRemaining: 5, expiresAt: new Date(Date.now() + 300000).toISOString() }
    });
    telegramAuthAPI.verifyOtp.mockResolvedValue({
      data: { token: 'jwt', user: { profileComplete: false }, isNew: true }
    });

    jest.useFakeTimers();
    render(<TelegramVerificationPanel phone="+251912345678" language="en" onSuccess={onSuccess} />);
    await act(async () => { fireEvent.click(screen.getByText(/Verify with Telegram/i)); });
    await act(async () => { jest.advanceTimersByTime(3100); });
    jest.useRealTimers();

    await waitFor(() => expect(screen.getByLabelText(/six digit verification code/i)).toBeInTheDocument());
    const input = screen.getByLabelText(/six digit verification code/i);
    await userEvent.type(input, '123456');
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(telegramAuthAPI.verifyOtp).toHaveBeenCalled());
  });
});

describe('TelegramVerificationPanel — cancel', () => {
  test('cancel button resets to idle', async () => {
    telegramAuthAPI.startSession.mockResolvedValue({
      data: { sessionId: 'sess-1234', deepLink: 'https://t.me/bot?start=x', botName: 'Bot', expiresAt: new Date(Date.now() + 600000).toISOString(), expiresInSeconds: 600 }
    });
    telegramAuthAPI.getSessionStatus.mockResolvedValue({ data: { status: 'pending' } });
    telegramAuthAPI.cancel.mockResolvedValue({ data: { success: true } });

    renderPanel();
    await act(async () => { fireEvent.click(screen.getByText(/Verify with Telegram/i)); });

    await waitFor(() => expect(screen.getByText(/Cancel & Restart/i)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Cancel & Restart/i));

    await waitFor(() => expect(screen.getByText(/Verify with Telegram/i)).toBeInTheDocument());
  });
});

describe('TelegramVerificationPanel — accessibility', () => {
  test('OTP input has accessible label', async () => {
    telegramAuthAPI.startSession.mockResolvedValue({
      data: { sessionId: 's', deepLink: 'https://t.me/b?start=x', botName: 'Bot', expiresAt: new Date(Date.now() + 600000).toISOString(), expiresInSeconds: 600 }
    });
    telegramAuthAPI.getSessionStatus.mockResolvedValue({
      data: { status: 'linked', otpAttemptsRemaining: 5, expiresAt: new Date(Date.now() + 300000).toISOString() }
    });

    jest.useFakeTimers();
    renderPanel();
    await act(async () => { fireEvent.click(screen.getByText(/Verify with Telegram/i)); });
    await act(async () => { jest.advanceTimersByTime(3100); });
    jest.useRealTimers();

    await waitFor(() => {
      const input = screen.queryByLabelText(/six digit verification code/i);
      expect(input).toBeInTheDocument();
    });
  });

  test('error messages use role=alert', async () => {
    telegramAuthAPI.startSession.mockRejectedValue({
      response: { data: { error: 'RATE_LIMITED', message: 'Too many attempts.' } }
    });
    renderPanel();
    await act(async () => { fireEvent.click(screen.getByText(/Verify with Telegram/i)); });
    await waitFor(() => {
      const alerts = screen.queryAllByRole('alert');
      expect(alerts.length).toBeGreaterThan(0);
    });
  });
});
