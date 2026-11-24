export {};

declare global {
  interface Window {
    runtimeConfig?: {
      supabaseUrl: string;
      supabaseKey: string;
    };
  }
}

async function bootstrap(): Promise<void> {
  try {
    const response = await fetch('/runtime-config.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('No se pudo cargar runtime-config.json.');
    }

    const runtimeConfig = await response.json() as {
      supabaseUrl?: string;
      supabaseKey?: string;
    };
    if (!runtimeConfig.supabaseUrl || !runtimeConfig.supabaseKey) {
      throw new Error('runtime-config.json no contiene la configuración de Supabase.');
    }

    window.runtimeConfig = {
      supabaseUrl: runtimeConfig.supabaseUrl,
      supabaseKey: runtimeConfig.supabaseKey
    };

    const [{ bootstrapApplication }, { App }, { appConfig }] = await Promise.all([
      import('@angular/platform-browser'),
      import('./app/app'),
      import('./app/app.config')
    ]);

    await bootstrapApplication(App, appConfig);

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        void navigator.serviceWorker.register('/sw.js').then(registration => {
          void registration.update();
        });
      });
    }
  } catch (error) {
    console.error(error);
    document.body.innerHTML = `
      <main style="min-height:100dvh;display:grid;place-items:center;background:#17141c;color:#fff;font-family:sans-serif;padding:24px;text-align:center">
        <section>
          <h1>No se pudo iniciar Nuestra Álbum</h1>
          <p>Configurá public/runtime-config.json y recargá la aplicación.</p>
        </section>
      </main>
    `;
  }
}

void bootstrap();