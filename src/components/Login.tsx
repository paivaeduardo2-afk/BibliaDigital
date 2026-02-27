import React, { useState } from "react";
import { motion } from "motion/react";
import { Loader2 } from "lucide-react";

interface LoginProps {
  onLogin: (user: { id: number; username: string }, token: string) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/signup";
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include"
      });

      const data = await response.json();
      if (response.ok) {
        console.log("Login successful, user data:", data);
        onLogin({ id: data.id, username: data.username }, data.token);
      } else {
        setError(data.error || "Ocorreu um erro");
      }
    } catch (err) {
      setError("Erro de conexão com o servidor");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-netflix-black flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://picsum.photos/seed/bible-login/1920/1080?blur=10" 
          className="w-full h-full object-cover opacity-20"
          alt="Background"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-netflix-black via-netflix-black/60 to-transparent" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md bg-black/70 backdrop-blur-xl p-12 rounded-lg border border-white/10 shadow-2xl"
      >
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-8 h-8 bg-netflix-red rounded-sm flex items-center justify-center text-xs font-black text-white">B</div>
          <span className="text-2xl font-black tracking-tighter text-white">BÍBLIA</span>
        </div>

        <h2 className="text-3xl font-bold text-white mb-8">
          {isLogin ? "Entrar" : "Criar Conta"}
        </h2>

        {error && (
          <div className="bg-orange-600/20 border border-orange-600/50 text-orange-200 p-4 rounded mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <input
              type="text"
              placeholder="Nome de usuário"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-5 py-4 bg-netflix-dark-gray/50 rounded border border-white/10 focus:border-white/40 outline-none text-white transition-all placeholder:text-white/40"
              required
            />
          </div>
          <div className="space-y-1">
            <input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-4 bg-netflix-dark-gray/50 rounded border border-white/10 focus:border-white/40 outline-none text-white transition-all placeholder:text-white/40"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-netflix-red text-white font-bold py-4 rounded hover:bg-netflix-red/90 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 text-lg"
          >
            {isLoading ? <Loader2 className="animate-spin" size={24} /> : (isLogin ? "Entrar" : "Cadastrar")}
          </button>
        </form>

        <div className="mt-12 text-white/50 text-sm">
          {isLogin ? (
            <p>
              Novo por aqui?{" "}
              <button 
                onClick={() => setIsLogin(false)}
                className="text-white hover:underline font-bold"
              >
                Cadastre-se agora.
              </button>
            </p>
          ) : (
            <p>
              Já tem uma conta?{" "}
              <button 
                onClick={() => setIsLogin(true)}
                className="text-white hover:underline font-bold"
              >
                Entrar agora.
              </button>
            </p>
          )}
        </div>

        <div className="mt-8 pt-8 border-t border-white/10 text-xs text-white/30 leading-relaxed">
          Esta página é protegida pelo Google reCAPTCHA para garantir que você não é um robô. 
          <button className="text-blue-500 hover:underline ml-1">Saiba mais.</button>
        </div>
      </motion.div>
    </div>
  );
}
