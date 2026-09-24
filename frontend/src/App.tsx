import { Routes, Route } from 'react-router'

import { RutaConPermiso, RutaInicial, RutaProtegida } from '@/auth/RutaProtegida'
import LoginPage from '@/auth/LoginPage'
import RegistroPage from '@/auth/RegistroPage'
import RecuperarPasswordPage from '@/auth/RecuperarPasswordPage'
import VerificarCodigoPage from '@/auth/VerificarCodigoPage'
import RestablecerPasswordPage from '@/auth/RestablecerPasswordPage'
import { AppShell } from '@/layout/AppShell'

import InicioPage from '@/features/inicio/InicioPage'
import DashboardPage from '@/features/dashboard/DashboardPage'
import ProductosPage from '@/features/productos/ProductosPage'
import InventarioPage from '@/features/inventario/InventarioPage'
import KardexPage from '@/features/kardex/KardexPage'
import VentasPage from '@/features/ventas/VentasPage'
import PrediccionPage from '@/features/prediccion/PrediccionPage'
import ModeloMLPage from '@/features/modelo-ml/ModeloMLPage'
import ConfiguracionPage from '@/features/configuracion/ConfiguracionPage'
import UsuariosPage from '@/features/usuarios/UsuariosPage'
import AuditoriaPage from '@/features/auditoria/AuditoriaPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<RegistroPage />} />
      <Route path="/recuperar" element={<RecuperarPasswordPage />} />
      <Route path="/verificar-codigo" element={<VerificarCodigoPage />} />
      <Route path="/restablecer" element={<RestablecerPasswordPage />} />

      <Route element={<RutaProtegida />}>
        <Route element={<AppShell />}>
          <Route index element={<RutaInicial><InicioPage /></RutaInicial>} />
          <Route element={<RutaConPermiso permiso="ver_kpis" />}><Route path="dashboard" element={<DashboardPage />} /></Route>
          <Route element={<RutaConPermiso permiso="gestionar_productos" />}><Route path="productos" element={<ProductosPage />} /></Route>
          <Route element={<RutaConPermiso permiso="gestionar_inventario" />}><Route path="inventario" element={<InventarioPage />} /><Route path="kardex" element={<KardexPage />} /></Route>
          <Route element={<RutaConPermiso permiso="gestionar_ventas" />}><Route path="ventas" element={<VentasPage />} /></Route>
          <Route element={<RutaConPermiso permiso="ver_kpis" />}><Route path="prediccion" element={<PrediccionPage />} /><Route path="modelo-ml" element={<ModeloMLPage />} /></Route>
          <Route element={<RutaConPermiso permiso="configurar_umbrales" />}><Route path="configuracion" element={<ConfiguracionPage />} /></Route>
          <Route element={<RutaConPermiso permiso="gestionar_usuarios" />}><Route path="usuarios" element={<UsuariosPage />} /></Route>
          <Route element={<RutaConPermiso permiso="ver_auditoria" />}><Route path="auditoria" element={<AuditoriaPage />} /></Route>
        </Route>
      </Route>
    </Routes>
  )
}
