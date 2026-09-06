import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/public/legal-page";
import { getCompanyIdentity } from "@/lib/legal/company-identity-server";
import { getLegalDocument } from "@/lib/legal/documents";

const document = getLegalDocument("privacy");

export const metadata: Metadata = {
  title: `${document.title} | dabi price`,
  description:
    "Como a dabi price coleta, usa, compartilha e protege dados pessoais, conforme a LGPD.",
};

export const revalidate = 3600;

export default async function PrivacyPage() {
  const companyIdentity = await getCompanyIdentity();

  return (
    <LegalPage document={document} identity={companyIdentity}>
      <p>
        Esta Política explica como a dabi price trata dados pessoais, conforme a
        Lei Geral de Proteção de Dados (Lei 13.709/2018). O controlador é{" "}
        {companyIdentity.legalName ?? "[razão social]"}, CNPJ{" "}
        {companyIdentity.cnpj}.
      </p>

      <h2>1. Dados que coletamos</h2>
      <h3>Quando você cria uma conta</h3>
      <ul>
        <li>nome completo, e-mail e senha (armazenada com hash, nunca em texto);</li>
        <li>nome do workspace e o segmento do seu negócio.</li>
      </ul>

      <h3>Quando você usa a plataforma</h3>
      <ul>
        <li>
          os dados comerciais que você informa: produtos, custos, insumos,
          margens, canais de venda e cálculos salvos;
        </li>
        <li>
          dados da empresa que você preencher em preferências, como telefone,
          cidade e e-mail operacional.
        </li>
      </ul>

      <h3>Quando você assina</h3>
      <ul>
        <li>
          histórico de assinatura, faturas e status de pagamento. Os dados do
          cartão são coletados e guardados pelo Mercado Pago, não por nós.
        </li>
      </ul>

      <h3>Automaticamente</h3>
      <ul>
        <li>
          endereço IP e data/hora do aceite dos Termos e desta Política, para
          comprovar o consentimento;
        </li>
        <li>
          registros técnicos de erro, para diagnóstico. Removemos dados pessoais
          desses registros antes do envio.
        </li>
      </ul>

      <h2>2. Por que tratamos esses dados</h2>
      <table>
        <thead>
          <tr>
            <th>Finalidade</th>
            <th>Base legal</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Criar e manter sua conta e seu workspace</td>
            <td>Execução de contrato</td>
          </tr>
          <tr>
            <td>Processar assinatura, cobrança e emissão de fatura</td>
            <td>Execução de contrato e obrigação legal</td>
          </tr>
          <tr>
            <td>Autenticação, prevenção a abuso e limite de tentativas</td>
            <td>Legítimo interesse em segurança</td>
          </tr>
          <tr>
            <td>Diagnóstico de erros e estabilidade</td>
            <td>Legítimo interesse</td>
          </tr>
          <tr>
            <td>Comunicações sobre a conta e a cobrança</td>
            <td>Execução de contrato</td>
          </tr>
          <tr>
            <td>Registro do aceite dos documentos legais</td>
            <td>Cumprimento de obrigação e exercício de direitos</td>
          </tr>
        </tbody>
      </table>

      <h2>3. Com quem compartilhamos</h2>
      <p>
        Não vendemos dados pessoais. Compartilhamos apenas com quem é necessário
        para o serviço funcionar:
      </p>
      <table>
        <thead>
          <tr>
            <th>Quem</th>
            <th>Para quê</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Mercado Pago</td>
            <td>Processar pagamentos e assinaturas</td>
          </tr>
          <tr>
            <td>Vercel</td>
            <td>Hospedagem da aplicação e dos arquivos enviados</td>
          </tr>
          <tr>
            <td>Neon</td>
            <td>Banco de dados</td>
          </tr>
          <tr>
            <td>Sentry</td>
            <td>Monitoramento de erros</td>
          </tr>
          <tr>
            <td>Resend</td>
            <td>Envio de e-mails transacionais</td>
          </tr>
          <tr>
            <td>Mercado Livre</td>
            <td>
              Somente se você conectar sua conta, para consultar taxas do canal
            </td>
          </tr>
        </tbody>
      </table>
      <p>
        Alguns desses serviços processam dados fora do Brasil. Nesses casos, a
        transferência internacional se apoia nas hipóteses do art. 33 da LGPD.
      </p>

      <h2>4. Por quanto tempo guardamos</h2>
      <ul>
        <li>
          dados de conta e cálculos: enquanto a conta existir, e por até 30 dias
          após a exclusão, para permitir arrependimento;
        </li>
        <li>
          registros fiscais e de cobrança: pelo prazo exigido pela legislação
          tributária;
        </li>
        <li>
          registro do aceite dos Termos: enquanto puder ser necessário para
          defesa de direitos;
        </li>
        <li>registros de erro: até 90 dias.</li>
      </ul>

      <h2>5. Seus direitos</h2>
      <p>
        A LGPD garante a você, a qualquer momento e sem custo: confirmação de
        tratamento, acesso, correção, anonimização ou exclusão de dados
        desnecessários, portabilidade, informação sobre compartilhamento,
        revogação de consentimento e revisão de decisões automatizadas.
      </p>
      <p>
        Para exercer qualquer um deles, use{" "}
        {companyIdentity.privacyEmail ? (
          <a href={`mailto:${companyIdentity.privacyEmail}`}>
            {companyIdentity.privacyEmail}
          </a>
        ) : (
          <Link href="/contato">nossa página de contato</Link>
        )}
        . Respondemos em até 15 dias.
      </p>

      <h2>6. Segurança</h2>
      <ul>
        <li>senhas guardadas como hash, nunca em texto legível;</li>
        <li>sessão em cookie <code>httpOnly</code>;</li>
        <li>limite de tentativas em login, cadastro e recuperação de senha;</li>
        <li>acesso ao banco restrito à aplicação.</li>
      </ul>
      <p>
        Nenhum sistema é totalmente imune. Em caso de incidente com risco
        relevante, comunicaremos você e a ANPD, como manda o art. 48 da LGPD.
      </p>

      <h2>7. Cookies</h2>
      <p>
        Usamos apenas o necessário para o serviço: o cookie de sessão, que
        mantém você autenticado, e o armazenamento local do navegador para
        lembrar preferências como o tema claro ou escuro. Não usamos cookies de
        publicidade nem rastreamento de terceiros.
      </p>

      <h2>8. Encarregado e contato</h2>
      <p>
        {companyIdentity.dataProtectionOfficer
          ? `Encarregado pelo tratamento de dados: ${companyIdentity.dataProtectionOfficer}.`
          : "O canal de comunicação com o titular dos dados está na página de contato."}{" "}
        {companyIdentity.privacyEmail ? (
          <a href={`mailto:${companyIdentity.privacyEmail}`}>
            {companyIdentity.privacyEmail}
          </a>
        ) : null}
      </p>

      <h2>9. Mudanças nesta Política</h2>
      <p>
        Ao alterarmos este documento, publicamos uma nova versão datada no topo
        da página. Mudanças relevantes no tratamento de dados serão comunicadas
        diretamente a você.
      </p>
    </LegalPage>
  );
}
