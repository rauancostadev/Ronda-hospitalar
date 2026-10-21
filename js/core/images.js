/**
 * Core - Controle de Imagens com Compressão no Front-end
 * Otimizado para evitar erros de "Memória Insuficiente" no Supabase
 */

const ImagesCore = {
    /**
     * Comprime uma imagem utilizando HTML5 Canvas antes do upload
     * @param {File} file - O arquivo de imagem original selecionado pelo usuário
     * @param {Object} options - Opções de redimensionamento e qualidade
     * @returns {Promise<Blob>} - Retorna um Blob comprimido pronto para o Supabase
     */
    async compressImage(file, options = { maxWidth: 1080, maxHeight: 1080, quality: 0.7 }) {
        return new Promise((resolve, reject) => {
            if (!file.type.startsWith('image/')) {
                return resolve(file); // Se não for imagem, retorna o arquivo original
            }

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    // Calcula novas dimensões mantendo o aspect ratio
                    if (width > height) {
                        if (width > options.maxWidth) {
                            height = Math.round((height * options.maxWidth) / width);
                            width = options.maxWidth;
                        }
                    } else {
                        if (height > options.maxHeight) {
                            width = Math.round((width * options.maxHeight) / height);
                            height = options.maxHeight;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Converte para Blob aplicando a qualidade estipulada (0.7 = 70% de qualidade)
                    canvas.toBlob(
                        (blob) => {
                            if (blob) {
                                // Preserva o nome original modificando apenas a extensão se necessário
                                const compressedFile = new File([blob], file.name, {
                                    type: 'image/jpeg',
                                    lastModified: Date.now(),
                                });
                                resolve(compressedFile);
                            } else {
                                reject(new Error('Falha na compressão da imagem através do Canvas.'));
                            }
                        },
                        'image/jpeg',
                        options.quality
                    );
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    },

    /**
     * Realiza o upload da imagem comprimida para o Supabase Storage
     * @param {string} bucketName - Nome do bucket no Supabase (ex: 'fotos')
     * @param {string} path - Caminho/Nome do arquivo no bucket
     * @param {File} file - Arquivo original vindo do input file
     */
    async uploadCompressed(bucketName, path, file) {
        try {
            console.log(`Tamanho original: ${(file.size / 1024).toFixed(2)} KB`);
            
            // Aplica a compressão automática
            const compressedFile = await this.compressImage(file);
            
            console.log(`Tamanho após compressão: ${(compressedFile.size / 1024).toFixed(2)} KB`);

            // Faz o upload utilizando o cliente global do Supabase do seu projeto
            const { data, error } = await supabase
                .storage
                .from(bucketName)
                .upload(path, compressedFile, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Erro ao comprimir e enviar imagem:', error);
            throw error;
        }
    }
};

window.ImagesCore = ImagesCore;
