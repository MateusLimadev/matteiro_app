-- ============================================================
-- MATTEIRO — schema.sql
-- Cole este script inteiro no SQL Editor do Supabase e execute.
-- ============================================================

-- ── TABELAS ─────────────────────────────────────────────────

-- Perfis (complementa auth.users com o nome do usuário)
CREATE TABLE IF NOT EXISTS profiles (
  id      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome    TEXT NOT NULL DEFAULT 'Usuário',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transações
CREATE TABLE IF NOT EXISTS transacoes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data        DATE NOT NULL,
  tipo        TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  descricao   TEXT NOT NULL,
  categoria   TEXT NOT NULL,
  valor       NUMERIC(12,2) NOT NULL,
  moeda       TEXT NOT NULL DEFAULT 'BRL',
  valor_brl   NUMERIC(12,2) NOT NULL,
  recorrente  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Categorias
CREATE TABLE IF NOT EXISTS categorias (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome    TEXT NOT NULL,
  tipo    TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  cor     TEXT NOT NULL DEFAULT '#607D8B',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contas fixas (recorrentes)
CREATE TABLE IF NOT EXISTS recorrentes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao        TEXT NOT NULL,
  categoria        TEXT NOT NULL,
  valor            NUMERIC(12,2) NOT NULL,
  dia_vencimento   INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  ativo            BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── ROW LEVEL SECURITY ──────────────────────────────────────
-- Cada usuário acessa APENAS seus próprios dados. Automático.

ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacoes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias  ENABLE ROW LEVEL SECURITY;
ALTER TABLE recorrentes ENABLE ROW LEVEL SECURITY;

-- Policies: all = SELECT + INSERT + UPDATE + DELETE
CREATE POLICY "profiles: own data"    ON profiles    FOR ALL USING (auth.uid() = id);
CREATE POLICY "transacoes: own data"  ON transacoes  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "categorias: own data"  ON categorias  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "recorrentes: own data" ON recorrentes FOR ALL USING (auth.uid() = user_id);

-- ── TRIGGER: cria perfil automaticamente no cadastro ────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO profiles (id, nome)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Usuário')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Planejamentos financeiros
CREATE TABLE IF NOT EXISTS planejamentos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo      TEXT NOT NULL,
  valor_meta  NUMERIC(12,2) NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim    DATE NOT NULL,
  ativo       BOOLEAN DEFAULT true,
  criado_em   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE planejamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "planejamentos: own data" ON planejamentos FOR ALL USING (auth.uid() = user_id);

-- ── ÍNDICES (performance) ────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_transacoes_user_data  ON transacoes    (user_id, data);
CREATE INDEX IF NOT EXISTS idx_categorias_user        ON categorias    (user_id);
CREATE INDEX IF NOT EXISTS idx_recorrentes_user_ativo ON recorrentes  (user_id, ativo);
CREATE INDEX IF NOT EXISTS idx_planejamentos_user     ON planejamentos (user_id, ativo);
