import { Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { useAuth } from "./AuthContext";

// HU12: inicio de sesión
const esquema = z.object({
  identifier: z.string().trim().min(1, "Ingresa tu correo"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});
type FormValues = z.infer<typeof esquema>;

function ahora(): number {
  return Date.now();
}

export default function LoginPage() {
  const { iniciarSesion } = useAuth();
  const navigate = useNavigate();
  const [enviando, setEnviando] = useState(false);
  const [bloqueoHasta, setBloqueoHasta] = useState<number | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState(0);
  const [mostrarPassword, setMostrarPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(esquema) });

  useEffect(() => {
    if (bloqueoHasta === null) return;

    const actualizarContador = () => {
      const milisegundos = Math.max(0, bloqueoHasta - Date.now());
      setSegundosRestantes(Math.ceil(milisegundos / 1000));
      if (milisegundos === 0) setBloqueoHasta(null);
    };

    actualizarContador();
    const intervalo = window.setInterval(actualizarContador, 250);
    return () => window.clearInterval(intervalo);
  }, [bloqueoHasta]);

  async function onSubmit(valores: FormValues) {
    setEnviando(true);
    try {
      await iniciarSesion(valores.identifier, valores.password);
      navigate("/", { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 429) {
        const cuerpo = error.body as { retryAfterMs?: unknown };
        if (
          typeof cuerpo.retryAfterMs === "number" &&
          cuerpo.retryAfterMs > 0
        ) {
          setBloqueoHasta(ahora() + cuerpo.retryAfterMs);
          return;
        }
      }
      const mensaje =
        error instanceof ApiError ? error.message : "No se pudo iniciar sesión";
      toast.error(mensaje);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[minmax(0,2fr)_minmax(370px,1fr)]">
      <div
        aria-hidden="true"
        className="hidden min-h-screen bg-cover bg-center lg:block"
        style={{ backgroundImage: "url('/fondo-login-vlag.png')" }}
      />

      <div className="flex min-h-screen items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-7 flex items-center gap-2">
            <img
              src="/logo_vlag.png"
              alt="VLAG"
              className="h-10 w-12 object-contain"
            />
            <span className="text-lg font-semibold">StockIA</span>
          </div>

          <h1 className="text-xl font-semibold">Bienvenido de nuevo</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ingresa tus credenciales para acceder al sistema.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="identifier">Correo</Label>
              <Input
                id="identifier"
                type="text"
                autoComplete="username"
                placeholder="correo@dominio.com"
                {...register("identifier")}
              />
              {errors.identifier && (
                <p className="text-xs text-destructive">
                  {errors.identifier.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Clave</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={mostrarPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register("password")}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={
                    mostrarPassword
                      ? "Ocultar contraseña"
                      : "Mostrar contraseña"
                  }
                >
                  {mostrarPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="text-right text-sm">
              <Link to="/recuperar" className="text-primary hover:underline">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            {bloqueoHasta !== null && (
              <p
                role="alert"
                aria-live="assertive"
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-center text-sm text-destructive"
              >
                Demasiadas solicitudes. Intenta nuevamente en{" "}
                <span className="font-semibold tabular-nums">
                  {`${Math.floor(segundosRestantes / 60)
                    .toString()
                    .padStart(
                      2,
                      "0",
                    )}:${(segundosRestantes % 60).toString().padStart(2, "0")}`}
                </span>
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={enviando || bloqueoHasta !== null}
            >
              {enviando ? "Ingresando…" : "Iniciar sesión"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}