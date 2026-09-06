import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/public/legal-page";
import { companyIdentity } from "@/lib/legal/company";
import { getLegalDocument } from "@/lib/legal/documents";

const document = getLegalDocument("terms");

export const metadata: Metadata = {
  title: `${document.title} | dabi price`,
  description:
    "Condições de uso da plataforma de precificação dabi price, incluindo assinatura, cobrança e cancelamento.",
};

export default function TermsPage() {
  return (
    <LegalPage document={document}>
      <p>
        Estes Termos regem o uso da plataforma dabi price, operada por{" "}
        {companyIdentity.legalName ?? "[razão social]"}, inscrita no CNPJ{" "}
        {companyIdentity.cnpj}. Ao criar uma conta, você declara que leu e
        concorda com estas condições e com a{" "}
        <Link href="/privacidade">Política de Privacidade</Link>.
      </p>

      <h2>1. O que a plataforma faz</h2>
      <p>
        A dabi price é uma ferramenta de cálculo de preços. Ela organiza custos,
        margem, taxas e perdas para sugerir um preço de venda. Os resultados são
        sugestões baseadas nos dados que você informa.
      </p>
      <p>
        <strong>A decisão de preço é sua.</strong> Não garantimos lucro, volume
        de vendas nem adequação a qualquer regime tributário. A plataforma não
        substitui contador, advogado ou consultoria financeira.
      </p>

      <h2>2. Conta e responsabilidade</h2>
      <ul>
        <li>Você é responsável pela veracidade dos dados que informa.</li>
        <li>
          A senha é pessoal. Compartilhá-la, ou permitir acesso de terceiros à
          conta, é responsabilidade sua.
        </li>
        <li>
          Você precisa ter capacidade legal para contratar. Contas empresariais
          devem ser criadas por quem tem poderes para isso.
        </li>
      </ul>

      <h2>3. Assinatura, preço e pagamento</h2>
      <p>
        O acesso é por assinatura recorrente, contratada por workspace. Os
        valores vigentes são os exibidos na página de planos no momento da
        contratação.
      </p>
      <ul>
        <li>
          O preço anunciado é o valor à vista no Pix. No cartão, o parcelamento
          em até 10x tem juros, informados antes da confirmação.
        </li>
        <li>
          O processamento do pagamento é feito pelo Mercado Pago. Não recebemos
          nem armazenamos os dados do seu cartão.
        </li>
        <li>
          A renovação é automática ao fim de cada ciclo, até que você cancele.
        </li>
      </ul>

      <h2>4. Cancelamento e reembolso</h2>
      <p>
        Você pode cancelar a qualquer momento pela área de assinatura. O
        cancelamento interrompe as renovações seguintes; o acesso permanece até
        o fim do ciclo já pago.
      </p>
      <p>
        <strong>Direito de arrependimento.</strong> Nos 7 dias corridos após a
        contratação, você pode desistir e receber de volta o valor pago, nos
        termos do art. 49 do Código de Defesa do Consumidor. Basta solicitar
        pelos canais de contato.
      </p>

      <h2>5. Uso aceitável</h2>
      <p>Ao usar a plataforma, você concorda em não:</p>
      <ul>
        <li>
          tentar obter acesso não autorizado a contas, dados ou infraestrutura;
        </li>
        <li>
          automatizar acesso de forma que degrade o serviço para outros usuários;
        </li>
        <li>
          revender, sublicenciar ou expor a plataforma como se fosse sua.
        </li>
      </ul>
      <p>
        Podemos suspender contas que violem estas regras, com aviso sempre que
        possível.
      </p>

      <h2>6. Seus dados e seu conteúdo</h2>
      <p>
        Os produtos, custos e cálculos que você cadastra são seus. Não os usamos
        para competir com o seu negócio nem os vendemos. O tratamento de dados
        pessoais está descrito na{" "}
        <Link href="/privacidade">Política de Privacidade</Link>.
      </p>

      <h2>7. Disponibilidade e limitação</h2>
      <p>
        Trabalhamos para manter a plataforma disponível, mas ela depende de
        serviços de terceiros e pode passar por manutenção ou indisponibilidade.
        Não nos responsabilizamos por lucros cessantes ou decisões comerciais
        tomadas a partir dos cálculos.
      </p>
      <p>
        Nossa responsabilidade, quando cabível, fica limitada ao valor pago por
        você nos 12 meses anteriores ao evento.
      </p>

      <h2>8. Mudanças nestes Termos</h2>
      <p>
        Podemos alterar estes Termos. Mudanças relevantes serão comunicadas com
        antecedência razoável, e a nova versão passa a valer na data indicada no
        topo desta página. Continuar usando a plataforma após a vigência
        significa concordar com o texto novo.
      </p>

      <h2>9. Foro e lei aplicável</h2>
      <p>
        Estes Termos são regidos pela lei brasileira. Para consumidores, fica
        eleito o foro do domicílio do consumidor, conforme o Código de Defesa do
        Consumidor.
      </p>

      <h2>10. Contato</h2>
      <p>
        Dúvidas sobre estes Termos podem ser enviadas pela{" "}
        <Link href="/contato">página de contato</Link>
        {companyIdentity.supportEmail ? ` ou por ${companyIdentity.supportEmail}` : ""}.
      </p>
    </LegalPage>
  );
}
