-- BANCO DE DADOS: nassautickets (MySQL 8.0 / MariaDB)
-- Sistema de Controle de Atendimento - Laboratório de Análises Clínicas

CREATE DATABASE IF NOT EXISTS nassautickets
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE nassautickets;

-- 1. Usuários
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    matricula VARCHAR(30) NOT NULL UNIQUE,
    login VARCHAR(50) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    perfil ENUM('ATENDENTE', 'GESTOR') NOT NULL DEFAULT 'ATENDENTE',
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Guichês de Atendimento
CREATE TABLE IF NOT EXISTS guiches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero INT NOT NULL UNIQUE,
    descricao VARCHAR(80) NOT NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- 3. Senhas
CREATE TABLE IF NOT EXISTS senhas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(15) NOT NULL UNIQUE COMMENT 'Formato YYMMDD-PPSQ',
    data_emissao DATE NOT NULL,
    tipo ENUM('SP', 'SE', 'SG') NOT NULL,
    sequencia INT NOT NULL,
    status ENUM(
        'EMITIDA',
        'AGUARDANDO',
        'CHAMADA',
        'CHAMADA_NOVAMENTE',
        'EM_ATENDIMENTO',
        'ATENDIDA',
        'NAO_COMPARECEU',
        'DESCARTADA'
    ) NOT NULL DEFAULT 'AGUARDANDO',
    guiche_id INT NULL,
    atendente_id INT NULL,
    emitida_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    primeira_chamada_em DATETIME NULL,
    segunda_chamada_em DATETIME NULL,
    inicio_atendimento_em DATETIME NULL,
    fim_atendimento_em DATETIME NULL,
    CONSTRAINT fk_senhas_guiche FOREIGN KEY (guiche_id) REFERENCES guiches(id) ON DELETE SET NULL,
    CONSTRAINT fk_senhas_atendente FOREIGN KEY (atendente_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    INDEX idx_data_tipo_seq (data_emissao, tipo, sequencia),
    INDEX idx_status_emitida (status, emitida_em),
    INDEX idx_chamadas_painel (primeira_chamada_em)
) ENGINE=InnoDB;

-- 4. Auditoria de Chamadas e Transições de Estado
CREATE TABLE IF NOT EXISTS auditoria_chamadas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    senha_id INT NOT NULL,
    atendente_id INT NULL,
    guiche_id INT NULL,
    acao VARCHAR(60) NOT NULL,
    status_anterior VARCHAR(30) NULL,
    status_novo VARCHAR(30) NOT NULL,
    registrado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_auditoria_senha FOREIGN KEY (senha_id) REFERENCES senhas(id) ON DELETE CASCADE,
    CONSTRAINT fk_auditoria_atendente FOREIGN KEY (atendente_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT fk_auditoria_guiche FOREIGN KEY (guiche_id) REFERENCES guiches(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- DADOS PARA TESTES E APRESENTAÇÃO

INSERT IGNORE INTO guiches (numero, descricao, ativo) VALUES
(1, 'Guichê 01 - Recepção Principal', 1),
(2, 'Guichê 02 - Recepção Central', 1),
(3, 'Guichê 03 - Atendimento Rápido / Geral', 1);

-- Senha padrão para teste: 123456
-- Hash bcrypt de '123456' (bcryptjs, custo 10)
INSERT IGNORE INTO usuarios (nome, matricula, login, senha_hash, perfil, ativo) VALUES
('Gestor Laboratório', '20260001', 'gestor', '$2a$10$Qibg9UUhwuga.sN4bCViweWuf7EjkaKvXd/UgpyLVWDz7JFB/QIcK', 'GESTOR', 1),
('Atendente Padrão', '20260002', 'atendente1', '$2a$10$Qibg9UUhwuga.sN4bCViweWuf7EjkaKvXd/UgpyLVWDz7JFB/QIcK', 'ATENDENTE', 1);
