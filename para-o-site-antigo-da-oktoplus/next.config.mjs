/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pg"],
  poweredByHeader: false,
  // A Oktoplus mudou para os Sistemas da THE TURISMO: qualquer endereço daqui leva para lá.
  async redirects() {
    return [{ source: "/:caminho*", destination: "https://theturismo-sistemas.web.app/", permanent: false }];
  },
};
export default nextConfig;
