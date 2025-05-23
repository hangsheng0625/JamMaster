from model import PopMusicTransformer
import os
os.environ['CUDA_VISIBLE_DEVICES'] = '0'

def main():
    # declare model
    model = PopMusicTransformer(
        checkpoint='REMI-finetune-classical-checkpoint',
        is_training=False)
    
    # generate from scratch
    model.generate(
        n_target_bar=16,
        temperature=1.2,
        topk=5,
        output_path='./result/from_scratch.midi',
        prompt=None)
    
    # generate continuation
    model.generate(
        n_target_bar=16,
        temperature=1.2,
        topk=5,
        output_path='./result/alb_esp1-output-2.midi',
        prompt='./data/evaluation/alb_esp1.mid')    
    # close model
    model.close()

if __name__ == '__main__':
    main()
