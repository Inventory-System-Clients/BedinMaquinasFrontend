import { useEffect, useRef } from "react";
import api from "../services/api";

export const ROTEIRO_LOCATION_STORAGE_KEY = "starbox:roteiro:localizacao-ativa";
export const ROTEIRO_LOCATION_CHANGED_EVENT = "starbox:roteiro-localizacao:changed";
export const ROTEIRO_LOCATION_STATUS_EVENT = "starbox:roteiro-localizacao:status";

const MIN_SEND_INTERVAL_MS = 10000;
const MIN_SEND_DISTANCE_METERS = 15;

function lerRoteiroAtivo() {
  try {
    const raw = localStorage.getItem(ROTEIRO_LOCATION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.error("Erro ao ler localizacao ativa do roteiro:", error);
    return null;
  }
}

function temTokenAutenticacao() {
  return Boolean(localStorage.getItem("token"));
}

function dispararStatus(status) {
  window.dispatchEvent(
    new CustomEvent(ROTEIRO_LOCATION_STATUS_EVENT, {
      detail: {
        status: status.status || "idle",
        mensagem: status.mensagem || "",
        roteiroId: status.roteiroId || null,
      },
    })
  );
}

function calcularDistanciaMetros(origem, destino) {
  if (!origem || !destino) return Infinity;

  const raioTerra = 6371000;
  const toRad = (valor) => (valor * Math.PI) / 180;
  const dLat = toRad(destino.latitude - origem.latitude);
  const dLon = toRad(destino.longitude - origem.longitude);
  const lat1 = toRad(origem.latitude);
  const lat2 = toRad(destino.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return raioTerra * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function RoteiroLocationTracker({ usuario }) {
  const watcherIdRef = useRef(null);
  const activeRoteiroRef = useRef(null);
  const lastSentRef = useRef(null);
  const sendingRef = useRef(false);

  useEffect(() => {
    const pararWatcher = (mensagem = "Compartilhamento de localizacao parado.") => {
      if (watcherIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watcherIdRef.current);
      }

      watcherIdRef.current = null;
      activeRoteiroRef.current = null;
      lastSentRef.current = null;
      sendingRef.current = false;
      dispararStatus({ status: "idle", mensagem });
    };

    const enviarLocalizacao = async (position) => {
      const roteiroAtivo = activeRoteiroRef.current || lerRoteiroAtivo();
      if (!roteiroAtivo?.roteiroId || sendingRef.current) return;
      if (!usuario?.id || !temTokenAutenticacao()) {
        pararWatcher("Entre novamente para continuar compartilhando sua localizacao.");
        return;
      }

      const coords = position.coords;
      const localizacaoAtual = {
        latitude: coords.latitude,
        longitude: coords.longitude,
      };

      const agora = Date.now();
      const ultimoEnvio = lastSentRef.current;
      const passouIntervalo = !ultimoEnvio || agora - ultimoEnvio.sentAt >= MIN_SEND_INTERVAL_MS;
      const moveuDistancia =
        !ultimoEnvio ||
        calcularDistanciaMetros(ultimoEnvio.localizacao, localizacaoAtual) >= MIN_SEND_DISTANCE_METERS;

      if (!passouIntervalo && !moveuDistancia) return;

      sendingRef.current = true;

      try {
        const capturedAt = new Date(position.timestamp || agora).toISOString();

        await api.post(
          `/roteiros/${roteiroAtivo.roteiroId}/localizacao`,
          {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
            altitude: coords.altitude,
            heading: coords.heading,
            speed: coords.speed,
            capturedAt,
            roteiroId: roteiroAtivo.roteiroId,
          },
          { skipAuthRedirect: true }
        );

        lastSentRef.current = {
          sentAt: agora,
          localizacao: localizacaoAtual,
        };

        dispararStatus({
          status: "sharing",
          mensagem: "Localizacao compartilhada com o administrador.",
          roteiroId: roteiroAtivo.roteiroId,
        });
      } catch (error) {
        console.error("Erro ao enviar localizacao do roteiro:", error);
        if (error.response?.status === 401 || error.response?.status === 403) {
          localStorage.removeItem(ROTEIRO_LOCATION_STORAGE_KEY);
          pararWatcher("Sessao sem permissao para compartilhar localizacao. Entre novamente.");
          return;
        }

        dispararStatus({
          status: "error",
          mensagem:
            error.response?.data?.error ||
            error.response?.data?.message ||
            "Nao foi possivel enviar sua localizacao agora.",
          roteiroId: roteiroAtivo.roteiroId,
        });
      } finally {
        sendingRef.current = false;
      }
    };

    const tratarErroGeolocalizacao = (error) => {
      const roteiroAtivo = activeRoteiroRef.current;
      const mensagem =
        error.code === error.PERMISSION_DENIED
          ? "Permissao de localizacao negada no navegador."
          : error.code === error.POSITION_UNAVAILABLE
            ? "Localizacao indisponivel no momento."
            : "Tempo esgotado ao buscar sua localizacao.";

      dispararStatus({
        status: "error",
        mensagem,
        roteiroId: roteiroAtivo?.roteiroId,
      });
    };

    const iniciarWatcher = () => {
      const roteiroAtivo = lerRoteiroAtivo();

      if (!roteiroAtivo?.roteiroId) {
        pararWatcher();
        return;
      }

      if (!usuario?.id || !temTokenAutenticacao()) {
        pararWatcher("Entre novamente para compartilhar sua localizacao.");
        return;
      }

      if (!navigator.geolocation) {
        dispararStatus({
          status: "error",
          mensagem: "Este navegador nao oferece suporte a geolocalizacao.",
          roteiroId: roteiroAtivo.roteiroId,
        });
        return;
      }

      if (usuario?.id && roteiroAtivo.usuarioId && String(usuario.id) !== String(roteiroAtivo.usuarioId)) {
        pararWatcher("Compartilhamento de localizacao parado para este usuario.");
        return;
      }

      if (
        watcherIdRef.current !== null &&
        String(activeRoteiroRef.current?.roteiroId) === String(roteiroAtivo.roteiroId)
      ) {
        return;
      }

      if (watcherIdRef.current !== null) {
        navigator.geolocation.clearWatch(watcherIdRef.current);
      }

      activeRoteiroRef.current = roteiroAtivo;
      lastSentRef.current = null;

      dispararStatus({
        status: "requesting",
        mensagem: "Solicitando permissao de localizacao...",
        roteiroId: roteiroAtivo.roteiroId,
      });

      watcherIdRef.current = navigator.geolocation.watchPosition(
        enviarLocalizacao,
        tratarErroGeolocalizacao,
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 15000,
        }
      );
    };

    const sincronizarWatcher = () => {
      const roteiroAtivo = lerRoteiroAtivo();
      if (roteiroAtivo?.roteiroId) {
        iniciarWatcher();
      } else {
        pararWatcher();
      }
    };

    window.addEventListener(ROTEIRO_LOCATION_CHANGED_EVENT, sincronizarWatcher);
    window.addEventListener("storage", sincronizarWatcher);
    sincronizarWatcher();

    return () => {
      window.removeEventListener(ROTEIRO_LOCATION_CHANGED_EVENT, sincronizarWatcher);
      window.removeEventListener("storage", sincronizarWatcher);
      if (watcherIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watcherIdRef.current);
      }
    };
  }, [usuario?.id]);

  return null;
}
