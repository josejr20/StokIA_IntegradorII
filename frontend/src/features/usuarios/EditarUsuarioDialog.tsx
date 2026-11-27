import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api";

import { useActualizarUsuario, type Rol, type Usuario } from "./api";

// La contraseña es opcional al editar: vacía significa "no cambiar".
const esquema = z.object({
  nombres: z.string().trim().min(2, "Ingresa los nombres"),
  apellidos: z.string().trim().min(2, "Ingresa los apellidos"),
  dni: z.string().trim().min(1, "Ingresa el DNI"),
  email: z.string().trim().email("Ingresa un correo válido"),
  rol_id: z.string().min(1, "Selecciona un rol"),
  password: z
    .string()
    .refine(
      (valor) =>
        valor === "" ||
        (valor.length >= 8 &&
          /[A-Z]/.test(valor) &&
          /[a-z]/.test(valor) &&
          /[0-9]/.test(valor) &&
          /[^A-Za-z0-9]/.test(valor)),
      "Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo",
    ),
});

type FormValues = z.infer<typeof esquema>;

interface Props {
  usuario: Usuario | null;
  roles: Rol[] | undefined;
  cargandoRoles: boolean;
  onCerrar: () => void;
}

export default function EditarUsuarioDialog({
  usuario,
  roles,
  cargandoRoles,
  onCerrar,
}: Props) {
  const actualizar = useActualizarUsuario();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(esquema) });

  useEffect(() => {
    if (usuario) {
      reset({
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        dni: usuario.dni ?? "",
        email: usuario.email,
        rol_id: String(usuario.rol_id),
        password: "",
      });
    }
  }, [usuario, reset]);

  async function onSubmit(valores: FormValues) {
    if (!usuario) return;
    const { password, rol_id, ...resto } = valores;
    try {
      await actualizar.mutateAsync({
        id: usuario.id,
        datos: {
          ...resto,
          rol_id: Number(rol_id),
          ...(password ? { password } : {}),
        },
      });
      toast.success("Usuario actualizado correctamente");
      onCerrar();
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "No se pudo actualizar el usuario",
      );
    }
  }

  return (
    <Dialog open={usuario !== null} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
          <DialogDescription>
            Modifica los datos o el rol de {usuario?.nombres} {usuario?.apellidos}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="editar-nombres">Nombres</Label>
              <Input id="editar-nombres" {...register("nombres")} />
              {errors.nombres && (
                <p className="text-xs text-destructive">{errors.nombres.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editar-apellidos">Apellidos</Label>
              <Input id="editar-apellidos" {...register("apellidos")} />
              {errors.apellidos && (
                <p className="text-xs text-destructive">{errors.apellidos.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editar-dni">DNI</Label>
              <Input id="editar-dni" {...register("dni")} />
              {errors.dni && (
                <p className="text-xs text-destructive">{errors.dni.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editar-email">Correo electrónico</Label>
              <Input id="editar-email" type="email" {...register("email")} />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editar-rol">Rol del empleado</Label>
              <select
                id="editar-rol"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                {...register("rol_id")}
              >
                {cargandoRoles && <option value="">Cargando roles…</option>}
                {roles?.map((rol) => (
                  <option key={rol.id} value={rol.id}>
                    {rol.nombre}
                  </option>
                ))}
              </select>
              {errors.rol_id && (
                <p className="text-xs text-destructive">{errors.rol_id.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="editar-password">Nueva contraseña (opcional)</Label>
              <Input
                id="editar-password"
                type="password"
                autoComplete="new-password"
                placeholder="Déjala vacía para no cambiarla"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={actualizar.isPending || cargandoRoles}>
              {actualizar.isPending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}