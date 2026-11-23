// Edite aqui os perfis. integ: 'metricool' (publica sozinho quando conectado), 'manual' (você posta; vídeo e legenda ficam prontos), 'pendente' (perfil ainda não identificado).
// compartilhaEm: perfis que o próprio Instagram já alimenta (compartilhamento nativo) — o painel bloqueia cópia duplicada.
const PERFIS = {
  'ig-romanno': { rede: 'Instagram', nome: 'Instagram Romanno Tecnologia', integ: 'metricool', conectado: false, compartilhaEm: [] },
  'tt-romanno': { rede: 'TikTok', nome: 'TikTok Romanno (@romanno.com.br)', integ: 'metricool', conectado: false },
  'fb-romanno': { rede: 'Facebook', nome: 'Facebook Romanno (a identificar)', integ: 'pendente' },
  'th-romanno': { rede: 'Threads', nome: 'Threads Romanno (a identificar)', integ: 'pendente' },
  'ig-buckley': { rede: 'Instagram', nome: 'Instagram Buckley', integ: 'manual', compartilhaEm: [] },
  'fb-buckley': { rede: 'Facebook', nome: 'Facebook Buckley (a identificar)', integ: 'pendente' },
  'th-buckley': { rede: 'Threads', nome: 'Threads Buckley (a identificar)', integ: 'pendente' },
  'tt-wear': { rede: 'TikTok', nome: 'TikTok Romanno Wear (@romannowear)', integ: 'manual' },
  'ig-wear': { rede: 'Instagram', nome: 'Instagram Romanno Wear (a identificar)', integ: 'pendente', compartilhaEm: [] },
  'th-wear': { rede: 'Threads', nome: 'Threads Romanno Wear (a identificar)', integ: 'pendente' },
  'fb-wear': { rede: 'Facebook', nome: 'Facebook Romanno Wear (a identificar)', integ: 'pendente' },
};

const PAINEIS = {
  marcas: {
    titulo: 'Romanno Tecnologia & Buckley',
    arquivo: 'data/marcas.json',
    grupos: {
      romanno: { nome: 'Romanno Tecnologia', destinos: ['ig-romanno', 'tt-romanno', 'fb-romanno', 'th-romanno'] },
      buckley: { nome: 'Buckley', destinos: ['ig-buckley', 'tt-romanno', 'fb-buckley', 'th-buckley'] },
    },
  },
  afiliados: {
    titulo: 'Afiliados — Romanno Wear',
    arquivo: 'data/afiliados.json',
    destinos: ['tt-wear', 'ig-wear', 'th-wear', 'fb-wear'],
  },
};
