'use client';

import { useEffect } from 'react';

export default function ErrorLoggerClient() {
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      // Prevent infinite loop if logging endpoint fails
      if (event.filename?.includes('/api/logs/system')) return;
      
      const errorData = {
        error_message: event.message || 'Uncaught Exception',
        stack_trace: event.error?.stack || null,
        url: window.location.href,
        component: 'client-global-error',
        severity: 'error',
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          userAgent: navigator.userAgent,
        },
      };

      fetch('/api/logs/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorData),
      }).catch(() => {});
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      
      // Prevent infinite loop if rejection occurs during error reporting
      if (reason instanceof Error && reason.stack?.includes('/api/logs/system')) return;

      const errorData = {
        error_message: reason instanceof Error ? reason.message : String(reason || 'Unhandled Promise Rejection'),
        stack_trace: reason instanceof Error ? reason.stack || null : null,
        url: window.location.href,
        component: 'client-unhandled-rejection',
        severity: 'error',
        metadata: {
          userAgent: navigator.userAgent,
        },
      };

      fetch('/api/logs/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorData),
      }).catch(() => {});
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
