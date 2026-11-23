// Marcas: cores e marca correspondente no Metricool (blogId). Plano gratuito do Metricool = 1 marca.
const MARCAS = {
  romanno: { nome: 'Romanno Tecnologia', cor: '#1C3B2E', cor2: '#25503F', claro: '#E7EDE9', metricool: '8070522' },
  buckley: { nome: 'Buckley', cor: '#2F7A5C', cor2: '#25503F', claro: '#DCE5E0', metricool: '' },
  wear: { nome: 'Romanno Wear', cor: '#111111', cor2: '#2A2A2A', claro: '#ECEFED', metricool: '' },
};

// integ: 'metricool' (publica sozinho quando conectado), 'manual' (você posta; vídeo e legenda ficam prontos), 'pendente' (perfil a identificar).
// compartilhaEm: perfis que o Instagram já alimenta (compartilhamento nativo) — o painel bloqueia cópia duplicada.
const PERFIS = {
  'ig-romanno': { marca: 'romanno', rede: 'Instagram', nome: 'Instagram Romanno Tecnologia', integ: 'metricool', conectado: false, compartilhaEm: [] },
  'tt-romanno': { marca: 'romanno', rede: 'TikTok', nome: 'TikTok Romanno (@romanno.com.br)', integ: 'metricool', conectado: false },
  'fb-romanno': { marca: 'romanno', rede: 'Facebook', nome: 'Facebook Romanno (a identificar)', integ: 'pendente' },
  'th-romanno': { marca: 'romanno', rede: 'Threads', nome: 'Threads Romanno (a identificar)', integ: 'pendente' },
  'ig-buckley': { marca: 'buckley', rede: 'Instagram', nome: 'Instagram Buckley', integ: 'manual', compartilhaEm: [] },
  'fb-buckley': { marca: 'buckley', rede: 'Facebook', nome: 'Facebook Buckley (a identificar)', integ: 'pendente' },
  'th-buckley': { marca: 'buckley', rede: 'Threads', nome: 'Threads Buckley (a identificar)', integ: 'pendente' },
  'tt-wear': { marca: 'wear', rede: 'TikTok', nome: 'TikTok Romanno Wear (@romannowear)', integ: 'manual' },
  'ig-wear': { marca: 'wear', rede: 'Instagram', nome: 'Instagram Romanno Wear (a identificar)', integ: 'pendente', compartilhaEm: [] },
  'th-wear': { marca: 'wear', rede: 'Threads', nome: 'Threads Romanno Wear (a identificar)', integ: 'pendente' },
  'fb-wear': { marca: 'wear', rede: 'Facebook', nome: 'Facebook Romanno Wear (a identificar)', integ: 'pendente' },
};

const PAINEIS = {
  marcas: {
    titulo: 'Romanno & Buckley',
    arquivo: 'data/marcas.json',
    grupos: {
      romanno: ['ig-romanno', 'tt-romanno', 'fb-romanno', 'th-romanno'],
      buckley: ['ig-buckley', 'tt-romanno', 'fb-buckley', 'th-buckley'], // vídeo do Buckley pode sair no TikTok da Romanno
    },
  },
  afiliados: {
    titulo: 'Afiliados',
    arquivo: 'data/afiliados.json',
    grupos: { wear: ['tt-wear', 'ig-wear', 'th-wear', 'fb-wear'] },
  },
};

const FORMATOS = ['Reels', 'Carrossel', 'Post', 'Story', 'Vídeo TikTok'];

const REDE_URL = {
  Instagram: 'https://business.facebook.com/latest/settings',
  Facebook: 'https://business.facebook.com/latest/settings',
  Threads: 'https://www.threads.net/',
  TikTok: 'https://www.tiktok.com/tiktokstudio',
};
