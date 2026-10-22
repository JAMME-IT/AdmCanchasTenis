import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import { Calendar, Clock, CreditCard, Shield, TrendingUp } from 'lucide-react';
import { ApiError, api, type Usuario } from '../lib/api';
import { Skeleton } from '../components/Feedback';

const pageStyle: React.CSSProperties = {
  fontFamily: 'system-ui, sans-serif',
  backgroundColor: '#F5F3EF',
  color: '#384543',
  minHeight: '100dvh',
  padding: '2rem 1.5rem 3rem',
};

const shellStyle: React.CSSProperties = {
  maxWidth: '1100px',
  margin: '0 auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '2rem',
};

const welcomeStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const welcomeTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '2rem',
  fontWeight: 700,
  color: '#384543',
};

const welcomeSubtitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1rem',
  color: '#5A6661',
};

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
};

const sectionHeaderStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.25rem',
  fontWeight: 600,
  color: '#384543',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: '1.25rem',
};

export default function Home(): JSX.Element {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [perfilIncompleto, setPerfilIncompleto] = useState(false);

  const cargarPerfil = useCallback(async () => {
    setPerfilIncompleto(false);
    try {
      const token = await getToken();
      const perfil = await api.me(token);
      setUsuario(perfil);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 403) {
        setPerfilIncompleto(true);
      }
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      return;
    }
    void cargarPerfil();
  }, [cargarPerfil, isLoaded, isSignedIn]);

  if (!isLoaded) {
    return (
      <main style={pageStyle}>
        <Skeleton rows={2} label="Cargando tu sesión…" />
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main style={pageStyle}>
        <div style={shellStyle}>
          <section style={{ backgroundColor: '#FFFFFF', border: '1px solid #8A9A93', borderRadius: '1rem', padding: '2rem' }}>
            <h1 style={{ margin: '0 0 1rem 0' }}>Tenis Ranch Club</h1>
            <p style={{ margin: '0 0 1.5rem 0', color: '#5A6661' }}>
              Gestión simple del club: tu sesión, tu perfil y tus turnos.
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <Link to="/ingresar" style={{ textDecoration: 'none' }}>
                <button style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#328161',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}>
                  Ingresar
                </button>
              </Link>
              <Link to="/registro" style={{ textDecoration: 'none' }}>
                <button style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#FFFFFF',
                  color: '#328161',
                  border: '2px solid #328161',
                  borderRadius: '0.5rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}>
                  Crear cuenta
                </button>
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        {perfilIncompleto && (
          <div style={{
            backgroundColor: '#FFF4E5',
            border: '1px solid #F5A623',
            borderRadius: '0.5rem',
            padding: '1rem',
            color: '#8B6914',
          }}>
            Tu perfil está incompleto. <Link to="/completar-perfil" style={{ color: '#328161', fontWeight: 600 }}>Completar perfil</Link>
          </div>
        )}

        {/* Saludo simple */}
        {usuario && (
          <div style={welcomeStyle}>
            <h1 style={welcomeTitleStyle}>
              ¡Hola, {usuario.nombre}! 👋
            </h1>
            <p style={welcomeSubtitleStyle}>
              ¿Qué querés hacer hoy?
            </p>
          </div>
        )}

        {/* Acciones rápidas */}
        <section style={sectionStyle}>
          <h2 style={sectionHeaderStyle}>Acciones rápidas</h2>
          <div style={gridStyle}>
            <Link to="/turnos" style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#FFFFFF',
              borderRadius: '1rem',
              padding: '1.5rem',
              textDecoration: 'none',
              color: '#384543',
              border: '2px solid transparent',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(56, 69, 67, 0.08)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#328161';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(50, 129, 97, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(56, 69, 67, 0.08)';
            }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.75rem',
                backgroundColor: '#E8F5F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}>
                <Calendar size={24} color="#328161" strokeWidth={2} />
              </div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 600 }}>
                Reservar cancha
              </h3>
              <p style={{ margin: 0, color: '#5A6661', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Elegí tu horario y reservá tu cancha
              </p>
            </Link>

            <Link to="/mis-turnos" style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#FFFFFF',
              borderRadius: '1rem',
              padding: '1.5rem',
              textDecoration: 'none',
              color: '#384543',
              border: '2px solid transparent',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(56, 69, 67, 0.08)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#21875A';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(33, 135, 90, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(56, 69, 67, 0.08)';
            }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.75rem',
                backgroundColor: '#E8F5F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}>
                <Clock size={24} color="#21875A" strokeWidth={2} />
              </div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 600 }}>
                Mis turnos
              </h3>
              <p style={{ margin: 0, color: '#5A6661', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Revisá tus turnos y cancelá si es necesario
              </p>
            </Link>

            <Link to="/mis-cuotas" style={{
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#FFFFFF',
              borderRadius: '1rem',
              padding: '1.5rem',
              textDecoration: 'none',
              color: '#384543',
              border: '2px solid transparent',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(56, 69, 67, 0.08)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#3FA67E';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(63, 166, 126, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(56, 69, 67, 0.08)';
            }}>
              <div style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '0.75rem',
                backgroundColor: '#E8F5F0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
              }}>
                <CreditCard size={24} color="#3FA67E" strokeWidth={2} />
              </div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 600 }}>
                Mis cuotas
              </h3>
              <p style={{ margin: 0, color: '#5A6661', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Controlá tus pagos y saldo pendiente
              </p>
            </Link>
          </div>
        </section>

        {/* Admin section */}
        {usuario?.rol === 'admin' && (
          <section style={sectionStyle}>
            <h2 style={sectionHeaderStyle}>Administración</h2>
            <div style={gridStyle}>
              <Link to="/admin" style={{
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#FFFFFF',
                borderRadius: '1rem',
                padding: '1.5rem',
                textDecoration: 'none',
                color: '#384543',
                border: '2px solid transparent',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(56, 69, 67, 0.08)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#384543';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(56, 69, 67, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'transparent';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(56, 69, 67, 0.08)';
              }}>
                <div style={{
                  width: '3rem',
                  height: '3rem',
                  borderRadius: '0.75rem',
                  backgroundColor: '#F0F0F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem',
                }}>
                  <Shield size={24} color="#384543" strokeWidth={2} />
                </div>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 600 }}>
                  Panel admin
                </h3>
                <p style={{ margin: 0, color: '#5A6661', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  Gestioná turnos, pagos y usuarios
                </p>
              </Link>

              <Link to="/admin" style={{
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#FFFFFF',
                borderRadius: '1rem',
                padding: '1.5rem',
                textDecoration: 'none',
                color: '#384543',
                border: '2px solid transparent',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(56, 69, 67, 0.08)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#8A9A93';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(138, 154, 147, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'transparent';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(56, 69, 67, 0.08)';
              }}>
                <div style={{
                  width: '3rem',
                  height: '3rem',
                  borderRadius: '0.75rem',
                  backgroundColor: '#F0F0F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1rem',
                }}>
                  <TrendingUp size={24} color="#8A9A93" strokeWidth={2} />
                </div>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 600 }}>
                  Reportes
                </h3>
                <p style={{ margin: 0, color: '#5A6661', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  Estadísticas e ingresos del club
                </p>
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
