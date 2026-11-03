# Culinary Dueño

App de consulta para dueños y gerentes de restaurantes con Culinary Restaurant, en Android y Windows. Lee los resúmenes de CulinaryServer (`/owner/v1`, `docs/API.md` de ese repositorio).

```bash
npm ci
npm run build
npx playwright test
```

La dirección de CulinaryServer se fija al compilar, con `VITE_SERVER_URL` en desarrollo y `-ServerUrl` en los instaladores. Si el instalador no la trae, la app la pide una vez al iniciar. `-ProviderName` y `-PrivacyEmail` ponen al proveedor y su correo en el aviso de privacidad; el texto sale de `docs/AVISO-PRIVACIDAD-PANEL.md` de MesaNexoNativo.

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File tools/build-windows.ps1 -ServerUrl https://mi-worker.workers.dev
```

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File tools/build-android.ps1 -Release -ServerUrl https://mi-worker.workers.dev
```

Los instaladores se firman con las llaves de `%USERPROFILE%\.culinary-firma` (`docs/FIRMA.md` de MesaNexoNativo). El plan está en `docs/PLAN-PANEL-PROPIETARIO.md` del mismo repositorio.
