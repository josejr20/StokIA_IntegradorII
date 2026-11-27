import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api";

import { useActualizarUsuario, useDesactivarUsuario, type Usuario } from "./api";

export type AccionEstado = "desactivar" | "reactivar";

interface Props {
  usuario: Usuario | null;
  accion: AccionEstado;
  onCerrar: () => void;
}

// HU-178: confirmación antes de desactivar o reactivar a un usuario.
export default function CambiarEstadoDialog({ usuario, accion, onCerrar }: Props) {
  const desactivar = useDesactivarUsuario();
  const actualizar = useActualizarUsuario();
  const procesando = desactivar.isPending || actualizar.isPending;
  const esDesactivar = accion === "desactivar";

  async function confirmar() {
    if (!usuario) return;
    try {
      if (esDesactivar) {
        await desactivar.mutateAsync(usuario.id);
      } else {
        await actualizar.mutateAsync({ id: usuario.id, datos: { activo: true } });
      }
      toast.success(
        esDesactivar ? "Usuario desactivado correctamente" : "Usuario reactivado correctamente",
      );
      onCerrar();
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : esDesactivar
            ? "No se pudo desactivar el usuario"
            : "No se pudo reactivar el usuario",
      );
    }
  }

  return (
    <Dialog open={usuario !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{esDesactivar ? "Desactivar usuario" : "Reactivar usuario"}</DialogTitle>
          <DialogDescription>
            {esDesactivar
              ? `${usuario?.nombres} ${usuario?.apellidos} ya no podrá iniciar sesión en el sistema. Podrás reactivarlo después.`
              : `${usuario?.nombres} ${usuario?.apellidos} volverá a poder iniciar sesión en el sistema.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCerrar} disabled={procesando}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant={esDesactivar ? "destructive" : "default"}
            onClick={confirmar}
            disabled={procesando}
          >
            {procesando ? "Procesando…" : esDesactivar ? "Desactivar" : "Reactivar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}