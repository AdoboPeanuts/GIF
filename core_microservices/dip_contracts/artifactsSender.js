const fs = require('fs-extra');
const { fabric } = require('@etherisc/microservice');


const product = process.env.npm_package_name;
const version = process.env.npm_package_version;
const network = process.env.NETWORK || 'development';
const { amqp, log } = fabric();

(
  async () => {
    try {
      await amqp.bootstrap();
      const files = await fs.readdir('./build/contracts');
      const artifacts = await Promise.all(files.map(file => fs.readFile(`./build/contracts/${file}`, 'utf-8')));
      artifacts.forEach((artifact) => {
        amqp.publish({
          messageType: 'contractDeployment',
          messageVersion: '1.*',
          content: {
            product, network, version, artifact,
          },
          correlationId: '',
        });
      });
      log.info('Published content of build folder');
      process.exit(0);
    } catch (e) {
      log.error(new Error(JSON.stringify({ message: e.message, stack: e.stack })));
      process.exit(1);
    }
  }
)();
