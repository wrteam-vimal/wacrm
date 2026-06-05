'use client';

import { useEffect, useRef, useState } from 'react';

interface HTMLEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function HTMLEditor({ value, onChange, placeholder, disabled }: HTMLEditorProps) {
  const containerRef = useRef<HTMLTextAreaElement>(null);
  const editorRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const onChangeRef = useRef(onChange);

  // Keep onChange ref updated to avoid re-initializing TinyMCE when onChange changes
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    // Load CDN script if not loaded
    const scriptId = 'tinymce-cdn-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    const initEditor = () => {
      if (!containerRef.current) return;
      
      const tinymce = (window as any).tinymce;
      if (!tinymce) {
        setError(true);
        return;
      }

      // If already initialized, destroy it first
      if (editorRef.current) {
        tinymce.remove(editorRef.current);
      }

      tinymce.init({
        target: containerRef.current,
        height: 350,
        menubar: false,
        plugins: [
          'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
          'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
          'insertdatetime', 'media', 'table', 'code', 'help', 'wordcount'
        ],
        toolbar: 'undo redo | blocks | ' +
          'bold italic forecolor | alignleft aligncenter ' +
          'alignright alignjustify | bullist numlist outdent indent | ' +
          'removeformat | link image | code',
        content_style: 'body { font-family:var(--font-sans, Inter, sans-serif); font-size:14px; background-color: #0f172a; color: #f1f5f9; }',
        skin: 'oxide-dark',
        content_css: 'dark',
        placeholder: placeholder || 'Write content here...',
        readonly: !!disabled,
        setup: (editor: any) => {
          editorRef.current = editor;
          
          editor.on('change keyup undo redo', () => {
            const content = editor.getContent();
            onChangeRef.current(content);
          });
        }
      });
      setLoaded(true);
    };

    if ((window as any).tinymce) {
      initEditor();
    } else {
      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/tinymce/6.8.2/tinymce.min.js';
        script.referrerPolicy = 'origin';
        script.async = true;
        document.body.appendChild(script);
      }

      const handleLoad = () => {
        initEditor();
      };

      const handleError = () => {
        setError(true);
      };

      script.addEventListener('load', handleLoad);
      script.addEventListener('error', handleError);

      return () => {
        script.removeEventListener('load', handleLoad);
        script.removeEventListener('error', handleError);
      };
    }

    return () => {
      if (editorRef.current && (window as any).tinymce) {
        (window as any).tinymce.remove(editorRef.current);
        editorRef.current = null;
      }
    };
  }, [disabled, placeholder]);

  // Keep editor content in sync with outer value, but only if it's different
  // (to prevent cursor jumping while typing).
  useEffect(() => {
    if (editorRef.current && loaded) {
      const currentContent = editorRef.current.getContent();
      if (currentContent !== value) {
        editorRef.current.setContent(value || '');
      }
    }
  }, [value, loaded]);

  if (error) {
    return (
      <div className="rounded-md border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
        Failed to load the HTML Editor. Please check your internet connection.
      </div>
    );
  }

  return (
    <div className="w-full rounded-md overflow-hidden border border-slate-800 bg-slate-950">
      {!loaded && (
        <div className="h-[350px] flex items-center justify-center text-slate-400 text-sm">
          Loading editor...
        </div>
      )}
      <textarea
        ref={containerRef}
        defaultValue={value}
        className={loaded ? 'hidden' : 'w-full h-[350px] bg-slate-900 border border-slate-800 text-white rounded p-3'}
        disabled={disabled}
      />
    </div>
  );
}
