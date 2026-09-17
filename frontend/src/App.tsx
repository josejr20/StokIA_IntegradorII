import { Routes, Route } from 'react-router'

import { RutaProtegida } from '@/auth/RutaProtegida'
import LoginPage from '@/auth/LoginPage'
import RecuperarPasswordPage from '@/auth/RecuperarPasswordPage'
import { AppShell } from '@/layout/AppShell'

import InicioPage from '@/features/inicio/InicioPage'
import DashboardPage from '@/features/dashboard/DashboardPage'
import ProductosPage from '@/features/productos/ProductosPage'
import InventarioPage from '@/features/inventario/InventarioPage'
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
      <Route path="/recuperar" element={<RecuperarPasswordPage />} />

      <Route element={<RutaProtegida />}>
        <Route element={<AppShell />}>
          <Route index element={<InicioPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="productos" element={<ProductosPage />} />
          <Route path="inventario" element={<InventarioPage />} />
          <Route path="ventas" element={<VentasPage />} />
          <Route path="prediccion" element={<PrediccionPage />} />
          <Route path="modelo-ml" element={<ModeloMLPage />} />
          <Route path="configuracion" element={<ConfiguracionPage />} />
          <Route path="usuarios" element={<UsuariosPage />} />
          <Route path="auditoria" element={<AuditoriaPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
